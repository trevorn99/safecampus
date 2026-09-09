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

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
