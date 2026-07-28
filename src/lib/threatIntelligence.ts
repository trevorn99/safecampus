import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

const anthropic = new Anthropic();

// Hard cap: at most one report per location per rolling week, regardless of
// source (weekly cron or the on-demand "Generate report now" button) — both
// call this before generateThreatReport().
export const MIN_DAYS_BETWEEN_REPORTS = 7;

export async function getNextEligibleGenerationDate(
  admin: SupabaseClient,
  locationId: string,
): Promise<Date | null> {
  const { data: latest } = await admin
    .from("threat_reports")
    .select("generated_at")
    .eq("location_id", locationId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return null;

  const nextEligible = new Date(
    new Date(latest.generated_at).getTime() + MIN_DAYS_BETWEEN_REPORTS * 24 * 60 * 60 * 1000,
  );
  return nextEligible.getTime() > Date.now() ? nextEligible : null;
}

type IncidentRow = {
  id: string;
  occurred_at: string;
  type: string;
  narrative: string;
  status: string;
};

type WatchlistRow = {
  id: string;
  name: string;
  severity: string;
  reason: string | null;
  description: string | null;
};

// Reads watchlist_entries/incident_reports directly (via the service-role
// client — never exposed to the browser), the same "audited server-side
// function" pattern the schema already calls for on watchlist_entries. The
// resulting summary is what location managers actually see, gated by
// threat_reports' own RLS.
function buildPrompt(
  locationName: string,
  locationAddress: string | null,
  orgContext: string | null,
  locationContext: string | null,
  incidents: IncidentRow[],
  watchlist: WatchlistRow[],
): string {
  const incidentsText = incidents.length
    ? incidents
        .map((incident) => `- [${incident.occurred_at}] ${incident.type} (${incident.status}): ${incident.narrative}`)
        .join("\n")
    : "None in the last 90 days.";
  const watchlistText = watchlist.length
    ? watchlist
        .map(
          (entry) =>
            `- ${entry.name} (severity: ${entry.severity}): ${entry.reason ?? entry.description ?? "no details on file"}`,
        )
        .join("\n")
    : "No active watchlist entries.";

  const contextSection = [
    orgContext ? `About this organization (provided by the org admin):\n${orgContext}` : null,
    locationContext ? `Specific concerns for this location (provided by the org admin):\n${locationContext}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const searchTarget = locationAddress ? `${locationName} (${locationAddress})` : locationName;

  return `You are drafting an internal threat intelligence brief for the safety team at "${locationName}". This is reviewed by a human admin before anyone else sees it — flag uncertainty rather than overstating confidence.
${contextSection ? `\n${contextSection}\n` : ""}
Incident reports (last 90 days):
${incidentsText}

Watchlist entries:
${watchlistText}

You have web search available — use it to check current public information relevant to physical safety planning at this location:
1. Recent or upcoming protests, demonstrations, rallies, or civil disturbances at or near ${searchTarget}${
    locationAddress ? "" : " (no street address is on file — search by name/region as best you can, and say so if that limits what you can find)"
  }.
2. Public advisories or warnings from government agencies — FBI, DHS/CISA, or state/local law enforcement — relevant to this location's region or the type of site it is.
Cite your source (publication or agency name, and approximate date) for anything drawn from a search result, so a human reviewer can verify it independently. If searches turn up nothing relevant, say so plainly rather than speculating or padding the report with generic advice.

Write a concise brief (4-6 short paragraphs) covering: (1) a summary of recent activity and any patterns from the incident/watchlist data above, (2) anything relevant found via web search (protests/civil unrest, government advisories), (3) specific risks or concerns worth the team's attention this week — weighing the org's own stated concerns alongside everything above, (4) any recommended precautions. If there's genuinely nothing notable anywhere, say so plainly rather than padding the report.`;
}

// Server-side tools (web search) can pause a turn after many internal
// search rounds (stop_reason: "pause_turn") — resume by re-sending the
// conversation so far, per Anthropic's documented pattern. Capped so one
// report can't loop indefinitely.
const MAX_PAUSE_TURN_RESUMES = 3;

export async function generateThreatReport(admin: SupabaseClient, locationId: string) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: location } = await admin
    .from("locations")
    .select("name, address, organization_id, threat_context")
    .eq("id", locationId)
    .single();

  const [{ data: org }, { data: incidents }, { data: watchlist }] = await Promise.all([
    admin.from("organizations").select("threat_context").eq("id", location?.organization_id).single(),
    admin
      .from("incident_reports")
      .select("id, occurred_at, type, narrative, status")
      .eq("location_id", locationId)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .returns<IncidentRow[]>(),
    admin
      .from("watchlist_entries")
      .select("id, name, severity, reason, description")
      .eq("location_id", locationId)
      .returns<WatchlistRow[]>(),
  ]);

  const prompt = buildPrompt(
    location?.name ?? "this location",
    location?.address ?? null,
    org?.threat_context ?? null,
    location?.threat_context ?? null,
    incidents ?? [],
    watchlist ?? [],
  );

  const tools: Anthropic.Messages.ToolUnion[] = [{ type: "web_search_20260209", name: "web_search" }];
  let messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: prompt }];

  let response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    tools,
    messages,
  });

  let resumes = 0;
  while (response.stop_reason === "pause_turn" && resumes < MAX_PAUSE_TURN_RESUMES) {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      tools,
      messages,
    });
    resumes += 1;
  }

  const summary = response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");

  const { data: report, error } = await admin
    .from("threat_reports")
    .insert({
      location_id: locationId,
      summary,
      status: "draft",
      source_refs: {
        incident_report_ids: (incidents ?? []).map((incident) => incident.id),
        watchlist_entry_ids: (watchlist ?? []).map((entry) => entry.id),
      },
    })
    .select()
    .single();

  if (error) throw error;
  return report;
}
