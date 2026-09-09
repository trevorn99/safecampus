import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

// Anthropic list prices, dollars per million tokens (platform.claude.com
// pricing, checked 2026-09-09). Only the models this app actually calls need
// an entry; an unknown model estimates as zero rather than guessing, and
// shows up as such in the platform-admin view.
const MODEL_RATES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
};

// Cache reads bill at ~0.1x the input rate and cache writes at ~1.25x.
// Nothing here uses prompt caching yet — each weekly report is a fresh
// prompt — so these only matter if that changes.
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

// Web search is billed per search on top of the tokens its results consume:
// $10 per 1,000 searches.
const WEB_SEARCH_COST = 10 / 1000;

export type UsageRow = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  web_search_requests: number;
};

export function estimateCostUsd(row: UsageRow): number {
  const rate = MODEL_RATES[row.model];
  if (!rate) return 0;
  return (
    (row.input_tokens * rate.input) / 1_000_000 +
    (row.output_tokens * rate.output) / 1_000_000 +
    (row.cache_read_input_tokens * rate.input * CACHE_READ_MULTIPLIER) / 1_000_000 +
    (row.cache_creation_input_tokens * rate.input * CACHE_WRITE_MULTIPLIER) / 1_000_000 +
    row.web_search_requests * WEB_SEARCH_COST
  );
}

export function formatUsd(amount: number): string {
  // Sub-cent totals are the normal case for a single report — rounding them
  // to $0.00 would make the whole table look empty.
  if (amount > 0 && amount < 0.01) return "<$0.01";
  return `$${amount.toFixed(2)}`;
}

// Called after every messages.create in a generation, including each
// pause_turn resume, so the ledger reflects API calls rather than reports.
// Never throws: a failure to record usage must not fail the report that was
// otherwise generated fine.
export async function recordClaudeUsage(
  admin: SupabaseClient,
  organizationId: string,
  reportId: string | null,
  model: string,
  usage: Anthropic.Messages.Usage,
): Promise<void> {
  try {
    await admin.from("claude_api_usage").insert({
      organization_id: organizationId,
      report_id: reportId,
      model,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      web_search_requests: usage.server_tool_use?.web_search_requests ?? 0,
    });
  } catch {
    // Swallowed on purpose — see above.
  }
}
