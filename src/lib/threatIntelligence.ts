import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

const anthropic = new Anthropic();

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

  return `You are drafting an internal threat intelligence brief for the safety team at "${locationName}". This is reviewed by a human admin before anyone else sees it — flag uncertainty rather than overstating confidence.
${contextSection ? `\n${contextSection}\n` : ""}
Incident reports (last 90 days):
${incidentsText}

Watchlist entries:
${watchlistText}

Write a concise brief (3-5 short paragraphs) covering: (1) a summary of recent activity and any patterns, (2) specific risks or concerns worth the team's attention this week — weighing the org's own stated concerns above alongside the incident/watchlist data, (3) any recommended precautions. If there's genuinely nothing notable, say so plainly rather than padding the report.`;
}

export async function generateThreatReport(admin: SupabaseClient, locationId: string) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: location } = await admin
    .from("locations")
    .select("name, organization_id, threat_context")
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
    org?.threat_context ?? null,
    location?.threat_context ?? null,
    incidents ?? [],
    watchlist ?? [],
  );

  const message = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  const summary = message.content.find((block) => block.type === "text")?.text ?? "";

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
