import "server-only";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, renderBrandedEmail, sendEmail } from "@/lib/email";

// A link an org admin sends to someone outside the organization — a church
// treasurer, a school business office — so they can pay for the
// subscription without an account. See billing_payment_links.
//
// The token is a bearer credential for one thing only: starting checkout
// for this organization's plan. The page it opens shows the organization's
// name and plan and nothing from inside it. Only its hash is stored.

export const PAYMENT_LINK_DAYS = 14;
const MAX_LINKS_PER_HOUR = 5;

export const hashPaymentToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export type ActivePaymentLink = {
  id: string;
  organizationId: string;
  payerEmail: string;
  expiresAt: Date;
};

export type LinkLookup =
  | { ok: true; link: ActivePaymentLink }
  | { ok: false; reason: "not_found" | "expired" | "revoked"; organizationId?: string };

export async function findPaymentLink(admin: SupabaseClient, token: string): Promise<LinkLookup> {
  // Tokens are 43 base64url characters. Anything else is refused before it
  // costs a query.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, reason: "not_found" };

  const { data } = await admin
    .from("billing_payment_links")
    .select("id, organization_id, payer_email, expires_at, revoked_at")
    .eq("token_hash", hashPaymentToken(token))
    .maybeSingle();

  if (!data) return { ok: false, reason: "not_found" };
  if (data.revoked_at) return { ok: false, reason: "revoked", organizationId: data.organization_id };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired", organizationId: data.organization_id };
  }
  return {
    ok: true,
    link: {
      id: data.id,
      organizationId: data.organization_id,
      payerEmail: data.payer_email,
      expiresAt: new Date(data.expires_at),
    },
  };
}

export type CreateLinkResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; status: number; error: string };

/**
 * Issues a new link and revokes any earlier one for the organization —
 * there's only ever one live link, so "who did we ask to pay?" has one
 * answer, and a resend can't leave an older link in someone's inbox still
 * working.
 */
export async function createPaymentLink({
  admin,
  organizationId,
  payerEmail,
  createdBy,
}: {
  admin: SupabaseClient;
  organizationId: string;
  payerEmail: string;
  createdBy: string;
}): Promise<CreateLinkResult> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("billing_payment_links")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", since);
  // Admin-only, so this is a guard against a stuck button or a script, not
  // an attacker: each link is an email sent from our domain.
  if ((count ?? 0) >= MAX_LINKS_PER_HOUR) {
    return { ok: false, status: 429, error: "Too many payment links sent in the last hour. Try again later." };
  }

  const now = new Date();
  await admin
    .from("billing_payment_links")
    .update({ revoked_at: now.toISOString() })
    .eq("organization_id", organizationId)
    .is("revoked_at", null);

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + PAYMENT_LINK_DAYS * 24 * 60 * 60 * 1000);
  const { error } = await admin.from("billing_payment_links").insert({
    organization_id: organizationId,
    token_hash: hashPaymentToken(token),
    payer_email: payerEmail,
    created_by: createdBy,
    expires_at: expiresAt.toISOString(),
  });
  if (error) return { ok: false, status: 400, error: error.message };
  return { ok: true, token, expiresAt };
}

export async function revokePaymentLinks(admin: SupabaseClient, organizationId: string) {
  return admin
    .from("billing_payment_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .is("revoked_at", null)
    .select("id");
}

export async function sendPaymentLinkEmail({
  origin,
  orgName,
  requesterName,
  payerEmail,
  url,
  expiresAt,
}: {
  origin: string;
  orgName: string;
  requesterName: string;
  payerEmail: string;
  url: string;
  expiresAt: Date;
}) {
  const expires = expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  // Written for someone who has never heard of SafeCampus and is being asked
  // for money by email — exactly the message a careful finance office
  // treats as fraud until shown otherwise. So: who asked, what for, that
  // payment happens on Stripe, and to check with the requester if unsure.
  return sendEmail({
    to: payerEmail,
    subject: `${orgName} asked you to set up their SafeCampus subscription`,
    text: [
      `${requesterName} at ${orgName} asked you to set up the organization's SafeCampus subscription.`,
      "",
      "SafeCampus is the scheduling and coordination tool their safety team uses. You don't need an account:",
      "the link below shows the plan and price, then takes you to Stripe's secure checkout to pay.",
      "",
      `Review and pay: ${url}`,
      "",
      `The link works until ${expires}. Receipts and future invoices will come to this address.`,
      "",
      `If you weren't expecting this, check with ${requesterName} at ${orgName} before paying, or ignore it —`,
      "nothing is charged unless you complete checkout.",
      "",
      "SafeCampus — scheduling and coordination for safety teams.",
      "https://www.safecampus.net · admin@safecampus.net",
    ].join("\n"),
    html: renderBrandedEmail({
      origin,
      eyebrow: orgName,
      bodyHtml: `<p style="margin:0 0 14px;font-size:17px;font-weight:700;line-height:1.4;color:#1c2430">${escapeHtml(orgName)} asked you to set up their SafeCampus subscription</p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1c2430">${escapeHtml(requesterName)} at ${escapeHtml(orgName)} sent you this so you can pay for the organization&rsquo;s subscription.</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#5b6670">SafeCampus is the scheduling and coordination tool their safety team uses. You don&rsquo;t need an account: the link shows the plan and price, then takes you to Stripe&rsquo;s secure checkout to pay. It works until ${escapeHtml(expires)}, and receipts will come to this address.</p>`,
      cta: { label: "Review and pay", url },
      footerHtml: `Sent by SafeCampus on behalf of ${escapeHtml(orgName)}, to ${escapeHtml(payerEmail)}.
            If you weren&rsquo;t expecting this, check with ${escapeHtml(requesterName)} at ${escapeHtml(orgName)} before paying, or ignore it &mdash; nothing is charged unless you complete checkout.`,
    }),
  });
}
