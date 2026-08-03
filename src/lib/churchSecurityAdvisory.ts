import "server-only";

const SOURCE_URL = "https://www.christianwarriortraining.com/p/current-church-security-threat-level";

// A single national rating (not per-organization or per-location) published
// by a third-party church security group, updated periodically — not a
// government source, so the prompt frames it accordingly. Fetched fresh on
// every report generation (at most weekly per org, and this is free/cheap)
// rather than cached, since there's no reliable signal for when it changes.
export async function fetchChurchSecurityAdvisory(): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(SOURCE_URL, {
      headers: {
        // A plain server-side fetch with no browser-like UA/headers gets
        // blocked by some sites' bot detection (see dhs.gov) — this one
        // isn't behind that, but a realistic UA costs nothing and avoids
        // relying on it staying that way.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const html = await response.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&ldquo;/g, '"')
    .replace(/&#8221;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const idx = text.indexOf("Current Threat Level");
  if (idx === -1) return null;

  // A window around the rating, not the whole page — the rest is nav,
  // subscribe prompts, and comments, none of it useful context for Claude.
  return text.slice(Math.max(0, idx - 200), idx + 1500).trim();
}
