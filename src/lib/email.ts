import "server-only";
import crypto from "crypto";

// Shared platform-wide SendGrid account (same model as SignalWire in
// sms.ts) — not per-org credentials. Raw REST call against the v3 Mail Send
// API rather than @sendgrid/mail: we only ever hit the one "send a message"
// endpoint, so a dependency-free fetch is simpler than pulling in a full
// client, and it matches how sendSms already talks to SignalWire.
//
// Supabase Auth's own mail (magic links, invite emails) also goes out over
// this SendGrid account, but through Supabase's custom-SMTP setting in its
// dashboard — nothing in this file is involved in those.
const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

export type EmailResult = { ok: boolean; error?: string };

export async function sendEmail({
  to,
  subject,
  text,
  html,
  unsubscribeUrl,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  unsubscribeUrl?: string | null;
}): Promise<EmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !from) {
    return { ok: false, error: "SendGrid is not configured" };
  }

  // RFC 8058 one-click unsubscribe: Gmail and Outlook surface a native
  // "Unsubscribe" button when both headers are present, and POST the URL
  // themselves rather than making the member open the link. /api/email/
  // unsubscribe handles both that POST and an ordinary click on the
  // footer link.
  const headers: Record<string, string> = unsubscribeUrl
    ? {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : {};

  const response = await fetch(SENDGRID_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: "SafeCampus" },
      subject,
      // v3 requires text/plain before text/html — the API rejects the
      // reversed order outright.
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    }),
  });

  // A successful send is 202 with an empty body; anything else carries a
  // JSON error payload worth logging into notifications.status.
  if (!response.ok) {
    const detail = await response.text();
    return { ok: false, error: detail || `SendGrid returned ${response.status}` };
  }
  return { ok: true };
}

// Unsubscribing has to work from an email client, with no session and no
// cookie — so the link carries its own proof. Deriving it as an HMAC of the
// member id keeps it out of the members table entirely, where the org-wide
// "read own org roster" policy would otherwise expose one member's token to
// every colleague. Rotating EMAIL_UNSUBSCRIBE_SECRET invalidates every
// previously mailed link at once.
export function unsubscribeToken(memberId: string): string | null {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(memberId).digest("base64url");
}

export function verifyUnsubscribeToken(memberId: string, token: string): boolean {
  const expected = unsubscribeToken(memberId);
  if (!expected || !token) return false;

  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  if (expectedBuffer.length !== tokenBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, tokenBuffer);
}

// Without the secret configured there is no verifiable link to offer, so
// point at the account page instead of mailing a dead URL — the toggle
// lives there either way. `oneClick` says whether the URL is safe to put in
// a List-Unsubscribe header: the account page would 404 the POST that
// Gmail's native button sends, so only the token form gets those headers.
export function unsubscribeUrlFor(origin: string, memberId: string): { url: string; oneClick: boolean } {
  const token = unsubscribeToken(memberId);
  return token
    ? { url: `${origin}/api/email/unsubscribe?member=${memberId}&token=${token}`, oneClick: true }
    : { url: `${origin}/account/mfa`, oneClick: false };
}

// The one branded shell every email this app sends goes through, so a new
// email can't drift into looking like a different product.
//
// Tables and inline styles because that's what clients support: Outlook
// renders through Word (no flexbox, no grid) and Gmail strips <style>
// blocks and external CSS, so nothing here can share ui.module.css and the
// colours are literal hex rather than the design tokens.
//
// Supabase Auth's own mail — sign-in links and invites — cannot call this;
// those templates live in the Supabase dashboard. Hand-written copies that
// match it are kept in supabase/email-templates/, and changing the look
// here means changing them too.
export function renderBrandedEmail({
  origin,
  eyebrow,
  bodyHtml,
  cta,
  footerHtml,
}: {
  origin: string;
  /** Usually the organization's name — who this mail is on behalf of. */
  eyebrow?: string | null;
  bodyHtml: string;
  cta?: { label: string; url: string };
  footerHtml: string;
}): string {
  const ctaBlock = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#0f7568;border-radius:8px">
                <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${escapeHtml(cta.label)}</a>
              </td></tr>
            </table>`
    : "";

  // Referenced by URL, not embedded: Gmail discards data: URIs in <img>,
  // and most clients block remote images by default anyway — so the
  // wordmark beside it is text and carries the brand when it never loads.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f4;padding:24px 12px;font-family:system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dfe4df;border-radius:12px;overflow:hidden">
        <tr>
          <td style="padding:20px 28px;border-bottom:1px solid #dfe4df">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:10px" valign="middle">
                  <img src="${escapeHtml(origin)}/images/logo-mark.png" width="28" height="28" alt="" style="display:block;border:0;width:28px;height:28px" />
                </td>
                <td valign="middle" style="font-size:17px;font-weight:700;color:#1c2430;letter-spacing:-0.01em">
                  Safe<span style="color:#0f7568">Campus</span>
                </td>
              </tr>
            </table>
            ${eyebrow ? `<div style="margin-top:8px;font-size:13px;color:#5b6670">${escapeHtml(eyebrow)}</div>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:28px">
            ${bodyHtml}
            ${ctaBlock}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 22px;border-top:1px solid #dfe4df;font-size:12px;line-height:1.6;color:#5b6670">
            ${footerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
