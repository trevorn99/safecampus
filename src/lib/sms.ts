import "server-only";

// Shared platform-wide Twilio account (same model as SendGrid) — not
// per-org credentials. Raw REST call rather than the Twilio SDK: we only
// ever hit the one "send a message" endpoint, so a dependency-free fetch
// is simpler than pulling in the full client.
export async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, error: "Twilio is not configured" };
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return { ok: false, error: detail };
  }
  return { ok: true };
}
