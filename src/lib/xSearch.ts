import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const X_SEARCH_URL = "https://api.x.com/2/tweets/search/recent";

// X's pay-per-use search pricing ($0.005/read, no built-in per-account spend
// cap) is what actually costs money here, not the query count — so the cap
// is on reads consumed, not requests made. 2,000 reads/org/month bounds
// worst-case spend at $10/org/month, comfortably inside the $30/mo Threat
// Intelligence add-on price. Hitting the cap doesn't fail a report — that
// cycle's brief just goes out without X coverage until the cap resets.
const MAX_X_READS_PER_ORG_PER_MONTH = 2000;

// The recent-search endpoint requires max_results in [10, 100] — below 10
// there's no way to spend the remaining budget on a valid request.
const MIN_QUERY_RESULTS = 10;
const RESULTS_PER_QUERY = 25;

export type XPost = {
  id: string;
  text: string;
  created_at: string;
};

function currentMonthStart(): string {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

async function getRemainingBudget(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { data } = await admin
    .from("x_api_usage")
    .select("reads_used")
    .eq("organization_id", organizationId)
    .gte("occurred_at", currentMonthStart());

  const used = (data ?? []).reduce((sum: number, row: { reads_used: number }) => sum + row.reads_used, 0);
  return Math.max(0, MAX_X_READS_PER_ORG_PER_MONTH - used);
}

async function searchRecentPosts(query: string, maxResults: number): Promise<{ posts: XPost[]; readsUsed: number }> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return { posts: [], readsUsed: 0 };

  const url = new URL(X_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", String(Math.max(MIN_QUERY_RESULTS, Math.min(100, maxResults))));
  url.searchParams.set("tweet.fields", "created_at");

  let response: Response;
  try {
    response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // Network failure — degrade gracefully, the report is still useful
    // without X coverage for this one query.
    return { posts: [], readsUsed: 0 };
  }

  if (!response.ok) {
    // Rate-limited, auth failure, or a transient API error — same
    // graceful-degradation logic, and nothing was actually read so no spend
    // to log.
    return { posts: [], readsUsed: 0 };
  }

  const body = (await response.json()) as {
    data?: { id: string; text: string; created_at: string }[];
    meta?: { result_count?: number };
  };
  const posts: XPost[] = (body.data ?? []).map((post) => ({
    id: post.id,
    text: post.text,
    created_at: post.created_at,
  }));
  return { posts, readsUsed: body.meta?.result_count ?? posts.length };
}

// Runs one query per location (protest/unrest near its address) plus one
// org-wide query (name mentions), stopping once the organization's monthly
// budget runs out, and returns the findings pre-formatted for the report
// prompt — this is pre-fetched data spliced into the prompt, the same way
// incidents/watchlist entries already are, not a tool Claude calls mid-run.
export async function gatherXFindings(
  admin: SupabaseClient,
  organizationId: string,
  orgName: string,
  locations: { name: string; address: string | null }[],
): Promise<string> {
  if (!process.env.X_BEARER_TOKEN) {
    return "Not checked — X/Twitter API access isn't configured for this deployment.";
  }

  let remaining = await getRemainingBudget(admin, organizationId);
  if (remaining < MIN_QUERY_RESULTS) {
    return "Skipped — this organization's monthly X/Twitter search budget is exhausted; no X data checked this cycle.";
  }

  const queries: { label: string; query: string }[] = [
    { label: orgName, query: `"${orgName}" (threat OR protest OR warning OR safety) -is:retweet lang:en` },
    ...locations
      .filter((location) => location.address)
      .map((location) => ({
        label: location.name,
        query: `"${location.address}" (protest OR rally OR demonstration OR threat) -is:retweet lang:en`,
      })),
  ];

  const sections: string[] = [];
  for (const { label, query } of queries) {
    if (remaining < MIN_QUERY_RESULTS) {
      sections.push(`${label}: skipped — monthly X/Twitter search budget exhausted.`);
      continue;
    }

    const { posts, readsUsed } = await searchRecentPosts(query, Math.min(RESULTS_PER_QUERY, remaining));
    if (readsUsed > 0) {
      remaining -= readsUsed;
      await admin.from("x_api_usage").insert({ organization_id: organizationId, reads_used: readsUsed, query });
    }

    sections.push(
      posts.length
        ? `${label} (query: ${query}):\n${posts
            .map((post) => `- [${post.created_at}] ${post.text.replace(/\s+/g, " ").trim()}`)
            .join("\n")}`
        : `${label}: no matching posts found (query: ${query}).`,
    );
  }

  return sections.join("\n\n");
}
