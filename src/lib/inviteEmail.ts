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
// tracking off, like every other email this app sends. The link itself
// points at /auth/confirm on our own domain rather than at Supabase's verify
// endpoint — see that route for why.

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
  actionLink,
}: {
  origin: string;
  orgName?: string | null;
  email: string;
  actionLink: string;
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
      `Accept your SafeCampus invitation: ${actionLink}`,
      "",
      "This link signs you in — there's no password to choose. It works once.",
      "",
      `This invitation was sent by SafeCampus on behalf of ${org}, to ${email}. If you weren't expecting it`,
      `you can safely ignore this email; no account exists until you accept. If you're unsure whether it's`,
      `genuine, contact ${org} directly rather than using this link.`,
      "",
      "SafeCampus — scheduling and coordination for safety teams.",
      "https://www.safecampus.net · admin@safecampus.net",
    ].join("\n"),
    html: renderBrandedEmail({
      origin,
      eyebrow: org,
      bodyHtml: `<p style="margin:0 0 14px;font-size:17px;font-weight:700;line-height:1.4;color:#1c2430">You&rsquo;ve been invited to join ${escapeHtml(org)} on SafeCampus</p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1c2430">${escapeHtml(org)} has invited you to create a SafeCampus account.</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#5b6670">SafeCampus is the scheduling tool their safety team uses &mdash; it&rsquo;s where you&rsquo;ll see the shifts you&rsquo;re signed up for, confirm or decline them, and keep your certifications up to date. This link signs you in; there&rsquo;s no password to choose, and it works once.</p>`,
      cta: { label: "Accept your SafeCampus invitation", url: actionLink },
      footerHtml: `This invitation was sent by SafeCampus on behalf of ${escapeHtml(org)}, to ${escapeHtml(email)}.
            If you weren&rsquo;t expecting it you can safely ignore this email &mdash; no account exists until you accept.
            If you&rsquo;re unsure whether it&rsquo;s genuine, contact ${escapeHtml(org)} directly rather than using this link.`,
    }),
  };
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
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: kind,
    email,
    options: {
      // No redirectTo: it only shapes the action_link that Supabase builds,
      // and we don't use that link. See below.
      //
      // Kept on the auth user even though this email no longer reads it:
      // anything Supabase itself mails this person later (a sign-in link
      // from its own template) can still name who invited them, and auth is
      // per-project rather than per-org, so metadata is the only place it
      // could come from.
      data: { organization_name: orgName?.trim() || null },
    },
  });

  // hashed_token rather than action_link. action_link points at
  // https://<project-ref>.supabase.co/auth/v1/verify?… — a domain the
  // recipient has never seen, under a button asking them to click it, in the
  // one message where looking legitimate is the whole job. The hashed token
  // is the same credential with the hostname left to us, verified by
  // /auth/confirm on our own domain.
  if (linkError || !link?.properties?.hashed_token) {
    return {
      ok: false,
      stage: "link",
      error: linkError?.message ?? "no link returned",
    };
  }

  const actionLink = `${origin}/auth/confirm?token_hash=${encodeURIComponent(
    link.properties.hashed_token,
  )}&type=${kind}`;

  const result = await sendEmail({
    to: email,
    ...buildInviteEmail({ origin, orgName, email, actionLink }),
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
