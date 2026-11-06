import "server-only";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { codeBlockHtml, escapeHtml, renderBrandedEmail, sendEmail } from "@/lib/email";

// Sign-in codes, minted here and mailed by the app rather than by Supabase.
//
// Supabase's signInWithOtp sends through whatever SMTP the project is
// configured with, using a template pasted into its dashboard — a pipe that
// was unverified and, when tested, delivered nothing. Invitations already go
// through our own SendGrid call and arrive, so codes now do too: one sender,
// one look, click tracking off, no dashboard template to keep in sync.
//
// The price is that admin.generateLink bypasses Supabase's own rate limits,
// so this module carries its own. See sign_in_code_requests.

const ADDRESS_COOLDOWN_MS = 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_ADDRESS_PER_WINDOW = 5;
const MAX_PER_IP_PER_WINDOW = 20;
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  // Deliberately loose — the mailbox is the real validation — but enough to
  // refuse obvious junk before it costs a database row and a send.
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number; message: string };

/**
 * Checks the limits for this address and client, and records the request
 * if it is allowed. Recorded before the send, so a request whose mail then
 * fails still counts — otherwise a failing send could be retried without
 * limit.
 *
 * Fails open if the ledger can't be read. The table arrives by migration,
 * and production migrations wait on a manual approval while the code that
 * uses them deploys immediately; failing closed would mean nobody could
 * sign in during that window, or ever, if the table went missing. The
 * failure is logged, and Supabase-side generateLink limits still apply.
 */
export async function checkSignInCodeLimits(
  admin: SupabaseClient,
  email: string,
  clientIp: string,
): Promise<RateLimitResult> {
  const emailHash = sha256(email);
  const ipHash = sha256(clientIp);
  const now = Date.now();
  const since = new Date(now - WINDOW_MS).toISOString();

  const [byAddress, byIp] = await Promise.all([
    admin
      .from("sign_in_code_requests")
      .select("requested_at")
      .eq("email_hash", emailHash)
      .gte("requested_at", since)
      .order("requested_at", { ascending: true }),
    admin
      .from("sign_in_code_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("requested_at", since),
  ]);

  if (byAddress.error || byIp.error) {
    console.error("sign-in code limits unavailable; allowing request", {
      address: byAddress.error?.message,
      ip: byIp.error?.message,
    });
    return { ok: true };
  }

  const times = (byAddress.data ?? []).map((row) => new Date(row.requested_at).getTime());
  const latest = times.length > 0 ? times[times.length - 1] : null;

  if (latest !== null && now - latest < ADDRESS_COOLDOWN_MS) {
    const wait = Math.ceil((ADDRESS_COOLDOWN_MS - (now - latest)) / 1000);
    return {
      ok: false,
      retryAfterSeconds: wait,
      message: `We just sent a code to this address. You can ask for another in ${wait} seconds.`,
    };
  }

  if (times.length >= MAX_PER_ADDRESS_PER_WINDOW) {
    const wait = Math.ceil((times[0] + WINDOW_MS - now) / 1000);
    return {
      ok: false,
      retryAfterSeconds: wait,
      message: `Too many codes have been requested for this address. Try again in ${Math.ceil(wait / 60)} minutes, and use the most recent email.`,
    };
  }

  if ((byIp.count ?? 0) >= MAX_PER_IP_PER_WINDOW) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
      message: "Too many sign-in codes have been requested from this network. Please try again later.",
    };
  }

  const { error: insertError } = await admin
    .from("sign_in_code_requests")
    .insert({ email_hash: emailHash, ip_hash: ipHash });
  if (insertError) {
    console.error("sign-in code request not recorded", insertError.message);
  }

  // Opportunistic pruning: cheap, needs no cron, and the ledger only has to
  // remember the last hour.
  if (Math.random() < 0.05) {
    await admin
      .from("sign_in_code_requests")
      .delete()
      .lt("requested_at", new Date(now - PRUNE_AFTER_MS).toISOString());
  }

  return { ok: true };
}

export function buildSignInCodeEmail({ origin, email, code }: { origin: string; email: string; code: string }) {
  return {
    subject: "Your SafeCampus sign-in code",
    text: [
      "Your SafeCampus sign-in code",
      "",
      code,
      "",
      "Type this code on the SafeCampus sign-in page. It works once and expires shortly; if it has,",
      "the same page will send you a new one.",
      "",
      `Someone asked to sign in to SafeCampus as ${email}. If it wasn't you, ignore this email — nobody`,
      "can sign in without this code. Never share it: SafeCampus will never ask you for it, by email, phone",
      "or text.",
      "",
      "SafeCampus — scheduling and coordination for safety teams.",
      "https://www.safecampus.net · admin@safecampus.net",
    ].join("\n"),
    html: renderBrandedEmail({
      origin,
      bodyHtml: `<p style="margin:0 0 14px;font-size:17px;font-weight:700;line-height:1.4;color:#1c2430">Your SafeCampus sign-in code</p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#1c2430">Type this code on the SafeCampus sign-in page. It works once and expires shortly &mdash; if it has, the same page will send you a new one.</p>
            ${codeBlockHtml(code, "Your sign-in code")}`,
      footerHtml: `Someone asked to sign in to SafeCampus as ${escapeHtml(email)}. If it wasn&rsquo;t you, ignore this email &mdash;
            nobody can sign in without this code. Never share it: SafeCampus will never ask you for it, by email, phone or text.`,
    }),
  };
}

export type SendCodeResult = { ok: true } | { ok: false; error: string };

/**
 * Mints a code for this address and mails it.
 *
 * An existing account gets a sign-in code (verified as type "email"). An
 * address with no account gets one created and an invite-type code
 * (verified as "invite") — the same "the code creates your account"
 * behaviour the sign-in page has always promised. The caller is told
 * neither: the response must not reveal whether an address has an account.
 */
export async function sendSignInCode({
  admin,
  origin,
  email,
}: {
  admin: SupabaseClient;
  origin: string;
  email: string;
}): Promise<SendCodeResult> {
  let { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });

  if (error && (error.code === "user_not_found" || error.status === 404 || /not found/i.test(error.message))) {
    ({ data: link, error } = await admin.auth.admin.generateLink({ type: "invite", email }));
  }

  const code = link?.properties?.email_otp;
  if (error || !code) {
    console.error("sign-in code not minted", { code: error?.code, message: error?.message });
    return { ok: false, error: "We couldn't create a code just now. Please try again in a minute." };
  }

  const sent = await sendEmail({ to: email, ...buildSignInCodeEmail({ origin, email, code }) });
  if (!sent.ok) {
    console.error("sign-in code not sent", sent.error);
    return { ok: false, error: "We couldn't send the code just now. Please try again in a minute." };
  }
  return { ok: true };
}
