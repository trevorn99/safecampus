import "server-only";
import crypto from "crypto";

// SignalWire's REST API (like Twilio's) rejects anything that isn't strict
// E.164 (error 21217, "To invalid format") — a plain <input type="tel">
// lets someone type "555-123-4567" or "(555) 123-4567", which fails
// silently since sendSms's caller doesn't always surface its error. US/CA
// only for now: 10 digits assumes a US area code, matching the "+1
// 555 555 5555" placeholder already shown on the opt-in form.
export function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// Shared platform-wide SignalWire account (same model as SendGrid) — not
// per-org credentials. SignalWire's Compatibility API mirrors Twilio's REST
// API almost exactly (same Messages.json shape, same Basic Auth pattern
// with Project ID/API Token standing in for Account SID/Auth Token) — the
// only real difference is the base URL includes your Space subdomain
// instead of a fixed host. Raw REST call rather than an SDK: we only ever
// hit the one "send a message" endpoint, so a dependency-free fetch is
// simpler than pulling in a full client.
export async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const spaceUrl = process.env.SIGNALWIRE_SPACE_URL;
  const projectId = process.env.SIGNALWIRE_PROJECT_ID;
  const apiToken = process.env.SIGNALWIRE_API_TOKEN;
  const fromNumber = process.env.SIGNALWIRE_FROM_NUMBER;

  if (!spaceUrl || !projectId || !apiToken || !fromNumber) {
    return { ok: false, error: "SignalWire is not configured" };
  }

  const auth = Buffer.from(`${projectId}:${apiToken}`).toString("base64");
  const response = await fetch(
    `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    return { ok: false, error: detail };
  }
  return { ok: true };
}

// Verifies the `x-signalwire-signature` header on inbound Compatibility API
// webhooks (STOP/HELP replies — see /api/sms/webhook). Same construction as
// Twilio's well-documented X-Twilio-Signature: HMAC-SHA1 of the exact
// webhook URL with every POST param's key+value appended in sorted-key
// order, base64-encoded — SignalWire's own SDK exposes this as
// validateRequest(signingKey, header, url, params), the same shape as
// Twilio's validator, which is why we trust this construction rather than
// guessing a new one. Verify against SIGNALWIRE_SIGNING_KEY, the signing
// key from the SignalWire dashboard's API Credentials page (may or may not
// be the same value as SIGNALWIRE_API_TOKEN — check the dashboard).
export function verifySignalWireSignature(url: string, params: Record<string, string>, signature: string): boolean {
  const signingKey = process.env.SIGNALWIRE_SIGNING_KEY;
  if (!signingKey || !signature) return false;

  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const expected = crypto.createHmac("sha1", signingKey).update(data, "utf8").digest("base64");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
