import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, renderBrandedEmail, sendEmail } from "@/lib/email";

// A first invitation and a resend are the same message to the same person
// about the same thing, so there is one copy of it here and both callers
// send it. They used to be two: the first invitation went out through
// Supabase Auth's own template (supabase/email-templates/invite.html) while
// a resend was built by hand in the route, which meant different subject
// lines, a different From address, and — until that template is pasted into
// the Supabase dashboard — a completely different-looking email. Someone
// chasing an invitation that went to spam got a second message that looked
// nothing like the first, which is the opposite of reassuring.
//
// Neither path lets Supabase send anything now: generateLink mints the link
// without mailing it, and it goes out over our own SendGrid with click
// tracking off, like every other email this app sends. It carries a typed
// code rather than a sign-in link, so a mail scanner opening links can't
// spend it — see app/login/page.tsx.

// Shown when the organization's name can't be read. Deliberately the same
// in every string below — a message that says "your organization" in the
// subject and "a safety team" in the body reads as a mail merge that failed.
const FALLBACK_ORG_NAME = "your organization";

export type InviteEmailContent = { subject: string; text: string; html: string };

/**
 * The invitation, as both callers send it.
 *
 * Written for a recipient who has never heard of SafeCampus and for the
 * filter deciding whether this is junk — the same information answers both.
 * Who invited them, what the product is, why it arrived, and what to do if
 * it wasn't expected. A two-line "you've been invited, click here" reads as
 * phishing to a person and scores as junk to Proofpoint.
 */
export function buildInviteEmail({
  origin,
  orgName,
  email,
  code,
  signInUrl,
}: {
  origin: string;
  orgName?: string | null;
  email: string;
  /** The one-time code. The only credential in the message. */
  code: string;
  /**
   * Opens the sign-in page with the address filled in. Deliberately not a
   * credential: a scanner that opens it lands on a form and nothing else.
   */
  signInUrl: string;
}): InviteEmailContent {
  const org = orgName?.trim() || FALLBACK_ORG_NAME;

  return {
    subject: `${org} invited you to join their safety team on SafeCampus`,
    text: [
      `You've been invited to join ${org} on SafeCampus`,
      "",
      `${org} has invited you to create a SafeCampus account.`,
      "",
      "SafeCampus is the scheduling tool their safety team uses: it's where you'll see the shifts you're",
      "signed up for, confirm or decline them, and keep your certifications up to date.",
      "",
      `Your invitation code: ${code}`,
      "",
      `To accept, open ${signInUrl}`,
      "and type the code. There's no password to choose. The code works once and expires after a while;",
      "if it has, the same page will send you a new one.",
      "",
      `This invitation was sent by SafeCampus on behalf of ${org}, to ${email}. If you weren't expecting it`,
      `you can safely ignore this email; no account exists until you accept. If you're unsure whether it's`,
      `genuine, contact ${org} directly, or go to www.safecampus.net yourself rather than using this email.`,
      "",
      "SafeCampus — scheduling and coordination for safety teams.",
      "https://www.safecampus.net · admin@safecampus.net",
    ].join("\n"),
    html: renderBrandedEmail({
      origin,
      eyebrow: org,
      bodyHtml: `<p style="margin:0 0 14px;font-size:17px;font-weight:700;line-height:1.4;color:#1c2430">You&rsquo;ve been invited to join ${escapeHtml(org)} on SafeCampus</p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1c2430">${escapeHtml(org)} has invited you to create a SafeCampus account.</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5b6670">SafeCampus is the scheduling tool their safety team uses &mdash; it&rsquo;s where you&rsquo;ll see the shifts you&rsquo;re signed up for, confirm or decline them, and keep your certifications up to date.</p>
            ${codeBlockHtml(code, "Your invitation code")}
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5b6670">Open SafeCampus and type this code to accept. There&rsquo;s no password to choose. The code works once and expires after a while &mdash; if it has, the sign-in page will send you a new one.</p>`,
      cta: { label: "Open SafeCampus to accept", url: signInUrl },
      footerHtml: `This invitation was sent by SafeCampus on behalf of ${escapeHtml(org)}, to ${escapeHtml(email)}.
            If you weren&rsquo;t expecting it you can safely ignore this email &mdash; no account exists until you accept.
            If you&rsquo;re unsure whether it&rsquo;s genuine, contact ${escapeHtml(org)} directly, or go to www.safecampus.net yourself rather than using this email.`,
    }),
  };
}

/**
 * The code, set large enough to read and copy at a glance. Monospace so 0
 * and O, 1 and l can't be confused; letter-spaced so it reads as six
 * characters rather than a number; and selectable text rather than an
 * image, so it survives images being blocked and can be pasted.
 */
export function codeBlockHtml(code: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">
              <tr><td align="center" style="background:#f4f6f4;border:1px solid #dfe4df;border-radius:10px;padding:18px 12px">
                <div style="font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#5b6670;margin:0 0 8px">${escapeHtml(label)}</div>
                <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:0.3em;color:#1c2430;line-height:1.2">${escapeHtml(code)}</div>
              </td></tr>
            </table>`;
}

export type SendInviteResult =
  | { ok: true; userId: string | null }
  | { ok: false; stage: "link"; error: string }
  // Carries the id even though it failed: with kind "invite" the auth
  // account is created the moment the link is minted, so a send failure
  // leaves a real account behind. A caller that drops it leaves the member
  // row unlinked, and the next resend then tries to invite an address that
  // already has an account — which Supabase refuses, with no way out of the
  // loop from the UI.
  | { ok: false; stage: "send"; error: string; userId: string | null };

/**
 * Mints a sign-in link and mails the invitation.
 *
 * `kind` is "invite" for an address with no account yet — which creates the
 * auth user, so the caller gets a userId to store on the member row — and
 * "magiclink" for a resend to someone already invited, since Supabase
 * refuses to invite an address it has already seen.
 *
 * `stage` separates "couldn't create the link" from "couldn't send the mail"
 * because the callers recover differently: a failed send on a first
 * invitation still leaves a real account behind, whose id the caller should
 * store even while reporting the failure.
 */
export async function sendInviteEmail({
  admin,
  origin,
  orgName,
  email,
  kind,
}: {
  admin: SupabaseClient;
  origin: string;
  orgName?: string | null;
  email: string;
  kind: "invite" | "magiclink";
}): Promise<SendInviteResult> {
  const mint = (type: "invite" | "magiclink") =>
    admin.auth.admin.generateLink({
      type,
      email,
      options: {
        // No redirectTo: it only shapes the action_link that Supabase
        // builds, and we don't use that link. See below.
        //
        // Kept on the auth user even though this email no longer reads it:
        // anything Supabase itself mails this person later (a sign-in link
        // from its own template) can still name who invited them, and auth
        // is per-project rather than per-org, so metadata is the only place
        // it could come from.
        data: { organization_name: orgName?.trim() || null },
      },
    });

  let linkKind = kind;
  let { data: link, error: linkError } = await mint(linkKind);

  // The address already has an account: removed from this organization and
  // added back (removal keeps the sign-in account, since it can span
  // organizations), invited by another organization, or signed up on their
  // own. Supabase refuses to "invite" an existing user, but the invitation
  // is still the right email to send — it just carries a sign-in link for
  // the account they already have, and the caller links the member row to
  // that account's id. The mailbox is still the proof: only whoever reads
  // this email can use the link.
  if (
    linkKind === "invite" &&
    linkError &&
    (linkError.code === "email_exists" ||
      linkError.code === "user_already_exists" ||
      /already been registered/i.test(linkError.message))
  ) {
    linkKind = "magiclink";
    ({ data: link, error: linkError } = await mint(linkKind));
  }

  // The emailed code (email_otp), never a link carrying the token. Mail
  // filters open every link in a message to inspect it, and a single-use
  // link opened by a scanner is spent before its recipient sees it. A code
  // has to be typed by a person.
  if (linkError || !link?.properties?.email_otp) {
    return {
      ok: false,
      stage: "link",
      error: linkError?.message ?? "no code returned",
    };
  }

  // `t` tells the sign-in page which kind of code this is, so it tries that
  // one first. Not a credential, and the page tries the other kind anyway.
  const signInUrl = `${origin}/login?invite=1&email=${encodeURIComponent(email)}&t=${
    linkKind === "invite" ? "invite" : "email"
  }`;

  const result = await sendEmail({
    to: email,
    ...buildInviteEmail({ origin, orgName, email, code: link.properties.email_otp, signInUrl }),
  });

  if (!result.ok) {
    return {
      ok: false,
      stage: "send",
      error: result.error ?? "unknown error",
      userId: link.user?.id ?? null,
    };
  }
  return { ok: true, userId: link.user?.id ?? null };
}
