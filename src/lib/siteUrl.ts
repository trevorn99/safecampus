import "server-only";

// The host that links in email should point at.
//
// Not the request's own origin, which is what every email used to use. Mail
// is sent from wherever the code happens to be running: a Vercel cron hits
// an internal deployment URL, so shift reminders could carry a link to
// `safecampus-abc123.vercel.app` — a hostname the recipient has never seen,
// in a message asking them to click it. The same reasoning as disabling
// SendGrid's click tracking: a link whose domain the reader can't recognise
// is the thing that makes a legitimate email look like a phish.
//
// SITE_URL is the real answer and should be set per Vercel environment
// (production → https://www.safecampus.net, dev → https://dev.safecampus.net).
// The host map below is a safety net for when it isn't, so that the
// production and dev deployments still send correct links on their own.
const CANONICAL: Record<string, string> = {
  "safecampus.net": "https://www.safecampus.net",
  "www.safecampus.net": "https://www.safecampus.net",
  "dev.safecampus.net": "https://dev.safecampus.net",
};

/**
 * The origin to build email links from, given the origin of the request
 * that triggered the send.
 *
 * Falls back to the request's own origin for anything unrecognised — a
 * preview deployment or localhost — because a wrong-but-real host still
 * works there, while forcing production's host would send a developer's
 * test mail pointing at production.
 */
export function publicOrigin(requestOrigin: string): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Misconfigured rather than unset: fall through to the host map
      // rather than sending mail with a malformed link in it.
    }
  }

  try {
    return CANONICAL[new URL(requestOrigin).hostname] ?? requestOrigin;
  } catch {
    return requestOrigin;
  }
}
