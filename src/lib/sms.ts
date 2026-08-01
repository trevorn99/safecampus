import "server-only";

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
