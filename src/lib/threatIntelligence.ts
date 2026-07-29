import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

const anthropic = new Anthropic();

// Hard cap: at most one report per location per rolling week, regardless of
// source (weekly cron or the on-demand "Generate report now" button) — both
// call this before generateThreatReport().
export const MIN_DAYS_BETWEEN_REPORTS = 7;

// If a "generating" placeholder is older than this, the run that created it
// crashed or hit the function timeout without cleaning up — treat it as
// stale rather than letting it block this location forever.
export const GENERATION_STALE_MINUTES = 10;

export type GenerationStatus =
  | { state: "idle" }
  | { state: "generating" }
  | { state: "cooldown"; nextEligibleAt: Date };

// The single source of truth for "can this location generate a report right
// now" — checked by the on-demand route, the weekly cron, and reflected in
// the UI, so leaving the page (or a retry, or the cron overlapping an
// on-demand click) can never start a second concurrent generation for the
// same location: the in-progress placeholder row (see generateThreatReport)
// itself is what "generating" detects.
export async function getGenerationStatus(admin: SupabaseClient, locationId: string): Promise<GenerationStatus> {
  const { data: latest } = await admin
    .from("threat_reports")
    .select("id, status, generated_at")
    .eq("location_id", locationId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return { state: "idle" };

  if (latest.status === "generating") {
    const ageMinutes = (Date.now() - new Date(latest.generated_at).getTime()) / 60_000;
    if (ageMinutes < GENERATION_STALE_MINUTES) {
      return { state: "generating" };
    }
    // Stale — the attempt that created this never finished it. Clean it up
    // and treat this location as free to try again.
    await admin.from("threat_reports").delete().eq("id", latest.id);
    return { state: "idle" };
  }

  const nextEligible = new Date(
    new Date(latest.generated_at).getTime() + MIN_DAYS_BETWEEN_REPORTS * 24 * 60 * 60 * 1000,
  );
  return nextEligible.getTime() > Date.now() ? { state: "cooldown", nextEligibleAt: nextEligible } : { state: "idle" };
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

You have web search and web fetch available. Use them to check current public information relevant to physical safety planning at this location:

1. **DHS national advisory level (always check).** Fetch https://www.dhs.gov/national-terrorism-advisory-system directly and report the current National Terrorism Advisory System bulletin status (e.g. no current advisory, or a summary of an active Bulletin/Alert and what it covers).
2. **Other government advisories.** Search for current FBI public warnings/press releases and DHS/CISA advisories relevant to this location's region or the type of site it is (e.g. search "FBI warning [region]" and "CISA advisory [region/sector]").
3. **Protests and civil unrest.** Recent or upcoming protests, demonstrations, rallies, or civil disturbances at or near ${searchTarget}${
    locationAddress ? "" : " (no street address is on file — search by name/region as best you can, and say so if that limits what you can find)"
  }.
4. **Public mentions relevant to this specific type of organization.** If the organization's own description above indicates a specific institution type (e.g. a house of worship, school, or event venue), tailor a search to that — for example, for a church/house of worship: search for recent news coverage of threats, hate crimes, or planned protests targeting similar institutions in the area, plus any faith-based security guidance DHS/FBI have issued (e.g. the Nonprofit Security Grant Program). This is a public web search only — it cannot see into private Facebook groups, Instagram, or TikTok, which are not indexed or accessible this way; look for public news coverage or public event listings that reference such activity instead, and say plainly that private-platform content is out of scope rather than implying it was checked.

Cite your source (publication or agency name, and approximate date) for anything drawn from a search or fetch result, so a human reviewer can verify it independently. If searches turn up nothing relevant, say so plainly rather than speculating or padding the report with generic advice.

Format the brief in markdown with exactly these five "## " section headings, in this order, each with 1-3 short paragraphs (use a bullet list only where you're listing several distinct items, e.g. multiple sources or precautions — not as a substitute for prose):
## Recent Activity
Summary of recent activity and any patterns from the incident/watchlist data above.
## Public Safety Findings
The DHS national advisory status, other government advisories, protests/civil unrest, and any org-type-specific public mentions found above — each with its cited source. State plainly if nothing relevant turned up.
## Risks & Concerns
Specific risks worth the team's attention this week, weighing the org's own stated concerns alongside everything above.
## Recommended Precautions
Concrete, actionable precautions. If there's genuinely nothing notable anywhere in this report, say so plainly under the relevant heading rather than padding it.
## Coverage Note
One or two sentences stating what was actually checked this time (e.g. "DHS NTAS, FBI/CISA search, and local protest search were checked; no direct access to private social media platforms") so a reviewer knows the report's real scope, not just its findings.`;
}

// Server-side tools (web search, web fetch) can pause a turn after many
// internal rounds (stop_reason: "pause_turn") — resume by re-sending the
// conversation so far, per Anthropic's documented pattern. Capped so one
// report can't loop indefinitely.
const MAX_PAUSE_TURN_RESUMES = 3;

export async function generateThreatReport(admin: SupabaseClient, locationId: string) {
  // Claim this location immediately, before any slow work — this row (not
  // client-side loading state) is what getGenerationStatus() sees, so it
  // survives the requester leaving the page, a retry, or the weekly cron
  // overlapping an on-demand click without any of them starting a second
  // concurrent generation for the same location. The server-side work below
  // continues to completion regardless of whether the original HTTP client
  // is still connected.
  const { data: placeholder, error: placeholderError } = await admin
    .from("threat_reports")
    .insert({ location_id: locationId, status: "generating" })
    .select("id")
    .single();
  if (placeholderError) throw placeholderError;

  try {
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

    const tools: Anthropic.Messages.ToolUnion[] = [
      { type: "web_search_20260209", name: "web_search" },
      { type: "web_fetch_20260209", name: "web_fetch" },
    ];
    let messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: prompt }];

    let response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 5000,
      thinking: { type: "adaptive" },
      tools,
      messages,
    });

    let resumes = 0;
    while (response.stop_reason === "pause_turn" && resumes < MAX_PAUSE_TURN_RESUMES) {
      messages = [...messages, { role: "assistant", content: response.content }];
      response = await anthropic.messages.create({
        model: "claude-opus-5",
        max_tokens: 5000,
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
      .update({
        summary,
        status: "draft",
        source_refs: {
          incident_report_ids: (incidents ?? []).map((incident) => incident.id),
          watchlist_entry_ids: (watchlist ?? []).map((entry) => entry.id),
        },
      })
      .eq("id", placeholder.id)
      .select()
      .single();

    if (error) throw error;
    return report;
  } catch (err) {
    // Don't leave a dead "generating" row occupying this location's weekly
    // slot — a failed attempt shouldn't block the next real one.
    await admin.from("threat_reports").delete().eq("id", placeholder.id);
    throw err;
  }
}
