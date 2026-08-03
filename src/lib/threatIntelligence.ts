import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gatherXFindings } from "./xSearch";

const anthropic = new Anthropic();

// Hard cap: at most one combined report per organization per rolling week,
// regardless of source (weekly cron or the on-demand "Generate report now"
// button) — both call this before generateThreatReport().
export const MIN_DAYS_BETWEEN_REPORTS = 7;

// If a "generating" placeholder is older than this, the run that created it
// crashed or hit the function timeout without cleaning up — treat it as
// stale rather than letting it block this organization forever.
export const GENERATION_STALE_MINUTES = 10;

export type GenerationStatus =
  | { state: "idle" }
  | { state: "generating" }
  | { state: "cooldown"; nextEligibleAt: Date };

// The single source of truth for "can this organization generate a report
// right now" — checked by the on-demand route, the weekly cron, and
// reflected in the UI, so leaving the page (or a retry, or the cron
// overlapping an on-demand click) can never start a second concurrent
// generation for the same org: the in-progress placeholder row (see
// generateThreatReport) itself is what "generating" detects.
export async function getGenerationStatus(admin: SupabaseClient, organizationId: string): Promise<GenerationStatus> {
  const { data: latest } = await admin
    .from("threat_reports")
    .select("id, status, generated_at")
    .eq("organization_id", organizationId)
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
    // and treat this org as free to try again.
    await admin.from("threat_reports").delete().eq("id", latest.id);
    return { state: "idle" };
  }

  const nextEligible = new Date(
    new Date(latest.generated_at).getTime() + MIN_DAYS_BETWEEN_REPORTS * 24 * 60 * 60 * 1000,
  );
  return nextEligible.getTime() > Date.now() ? { state: "cooldown", nextEligibleAt: nextEligible } : { state: "idle" };
}

type LocationInfo = {
  id: string;
  name: string;
  address: string | null;
  threat_context: string | null;
};

type IncidentRow = {
  id: string;
  location_id: string;
  occurred_at: string;
  type: string;
  narrative: string;
  status: string;
};

type WatchlistRow = {
  id: string;
  location_id: string | null;
  name: string;
  severity: string;
  reason: string | null;
  description: string | null;
};

// Reads watchlist_entries/incident_reports directly (via the service-role
// client — never exposed to the browser), the same "audited server-side
// function" pattern the schema already calls for on watchlist_entries. The
// resulting summary is what org admins actually see, gated by
// threat_reports' own RLS.
function buildPrompt(
  orgName: string,
  orgContext: string | null,
  locations: LocationInfo[],
  incidents: IncidentRow[],
  watchlist: WatchlistRow[],
  xFindings: string,
): string {
  const locationName = (locationId: string | null) =>
    locations.find((location) => location.id === locationId)?.name ?? "an unspecified location";

  const incidentsText = incidents.length
    ? incidents
        .map(
          (incident) =>
            `- [${incident.occurred_at}] (${locationName(incident.location_id)}) ${incident.type} (${incident.status}): ${incident.narrative}`,
        )
        .join("\n")
    : "None across any location in the last 90 days.";
  const watchlistText = watchlist.length
    ? watchlist
        .map(
          (entry) =>
            `- ${entry.name} (${locationName(entry.location_id)}, severity: ${entry.severity}): ${entry.reason ?? entry.description ?? "no details on file"}`,
        )
        .join("\n")
    : "No active watchlist entries at any location.";

  const locationsList = locations
    .map((location) => {
      const parts = [location.name];
      if (location.address) parts.push(`(${location.address})`);
      if (location.threat_context) parts.push(`— specific concerns noted: ${location.threat_context}`);
      return `- ${parts.join(" ")}`;
    })
    .join("\n");

  const searchTargets = locations
    .filter((location) => location.address)
    .map((location) => `${location.name} (${location.address})`);

  const contextSection = orgContext ? `About this organization (provided by the org admin):\n${orgContext}\n` : "";

  return `You are drafting an internal threat intelligence brief for the safety team at "${orgName}", covering ALL of its locations/campuses together as one combined organization-wide report. This is reviewed by a human admin before anyone else sees it — flag uncertainty rather than overstating confidence.

${contextSection}
Locations covered by this report:
${locationsList || "No locations on file."}

Incident reports across all locations (last 90 days):
${incidentsText}

Watchlist entries across all locations:
${watchlistText}

You have web search available. Use it to check current public information relevant to physical safety planning across these locations:

1. **DHS national advisory level (always check).** Search for the current DHS National Terrorism Advisory System (NTAS) bulletin status (e.g. search "DHS National Terrorism Advisory System current bulletin") and report what you find — no current advisory, or a summary of an active Bulletin/Alert and what it covers. This applies to the whole organization, not any one campus.
2. **Other government advisories.** Search for current FBI public warnings/press releases and DHS/CISA advisories relevant to this organization's region(s) or the type of sites it operates.
3. **Protests and civil unrest, per location.** For each location with an address below, search for recent or upcoming protests, demonstrations, rallies, or civil disturbances near it, and note which campus each finding applies to: ${
    searchTargets.length ? searchTargets.join("; ") : "no locations have a street address on file — say so rather than guessing"
  }.
4. **Public mentions relevant to this specific type of organization.** If the organization's own description above indicates a specific institution type (e.g. a house of worship, school, or event venue), tailor a search to that — for example, for a church/house of worship: search for recent news coverage of threats, hate crimes, or planned protests targeting similar institutions, plus any faith-based security guidance DHS/FBI have issued (e.g. the Nonprofit Security Grant Program). This is a public web search — it cannot see into private Facebook groups, Instagram, or TikTok, which are not indexed or reachable this way via an automated API; look for public news coverage or public event listings that reference such activity instead, and say plainly that private-platform content is out of scope rather than implying it was checked.

X/Twitter was already pre-searched for you (not something you need to search for yourself) — one query direct from the official DHS/FBI/CISA/FEMA accounts, one for the organization's name, plus one per location address, all run through the X API directly. Fold genuinely relevant findings into the sections above (official-account posts under items 1-2, protest/unrest chatter under item 3, general threat/safety mentions under item 4); if a line below says a query was skipped or exhausted, or found nothing, say so plainly rather than guessing at what it might have found:

${xFindings}

Cite your source (publication/agency name and approximate date for web search results; "X/Twitter search" and the post date for X findings) for anything drawn from a search result, so a human reviewer can verify it independently. If searches turn up nothing relevant, say so plainly rather than speculating or padding the report with generic advice. Where a finding applies to one specific campus rather than the whole organization, name that campus.

Write each paragraph as full, flowing prose — multiple sentences joined together normally, not one sentence per line and not a line break after every period. Only start a new line for an actual new paragraph, a bullet/numbered list item, or a heading.

Format the brief in markdown with exactly these five "## " section headings, in this order, each with 1-3 short paragraphs (use a bullet list only where you're listing several distinct items, e.g. multiple sources, multiple locations, or precautions — not as a substitute for prose):
## Recent Activity
Summary of recent activity and any patterns from the incident/watchlist data above, across all locations — note which campus each item involves.
## Public Safety Findings
The DHS national advisory status, other government advisories, protests/civil unrest per location, any org-type-specific public mentions found above, and any relevant X/Twitter findings — each with its cited source. State plainly if nothing relevant turned up.
## Risks & Concerns
Specific risks worth the team's attention this week, weighing the org's own stated concerns (and each location's, where given) alongside everything above.
## Recommended Precautions
Concrete, actionable precautions — call out which campus a precaution applies to if it's not organization-wide. If there's genuinely nothing notable anywhere in this report, say so plainly under the relevant heading rather than padding it.
## Coverage Note
One or two sentences stating what was actually checked this time (e.g. "DHS NTAS, FBI/CISA search, a per-location protest search, and X/Twitter search were checked for N locations; no direct access to private Facebook groups, Instagram, or TikTok") so a reviewer knows the report's real scope, not just its findings.`;
}

// Server-side tools (web search) can pause a turn after many internal
// rounds (stop_reason: "pause_turn") — resume by re-sending the
// conversation so far, per Anthropic's documented pattern. Capped so one
// report can't loop indefinitely.
const MAX_PAUSE_TURN_RESUMES = 3;

export async function generateThreatReport(admin: SupabaseClient, organizationId: string) {
  // Claim this organization immediately, before any slow work — this row
  // (not client-side loading state) is what getGenerationStatus() sees, so
  // it survives the requester leaving the page, a retry, or the weekly cron
  // overlapping an on-demand click without any of them starting a second
  // concurrent generation for the same org. The server-side work below
  // continues to completion regardless of whether the original HTTP client
  // is still connected.
  const { data: placeholder, error: placeholderError } = await admin
    .from("threat_reports")
    .insert({ organization_id: organizationId, status: "generating" })
    .select("id")
    .single();
  if (placeholderError) throw placeholderError;

  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: org }, { data: locations }] = await Promise.all([
      admin.from("organizations").select("name, threat_context").eq("id", organizationId).single(),
      admin
        .from("locations")
        .select("id, name, address, threat_context")
        .eq("organization_id", organizationId)
        .order("name")
        .returns<LocationInfo[]>(),
    ]);

    const locationIds = (locations ?? []).map((location) => location.id);

    const [{ data: incidents }, { data: watchlist }] = await Promise.all([
      locationIds.length
        ? admin
            .from("incident_reports")
            .select("id, location_id, occurred_at, type, narrative, status")
            .in("location_id", locationIds)
            .gte("occurred_at", since)
            .order("occurred_at", { ascending: false })
            .returns<IncidentRow[]>()
        : Promise.resolve({ data: [] as IncidentRow[] }),
      locationIds.length
        ? admin
            .from("watchlist_entries")
            .select("id, location_id, name, severity, reason, description")
            .in("location_id", locationIds)
            .returns<WatchlistRow[]>()
        : Promise.resolve({ data: [] as WatchlistRow[] }),
    ]);

    const xFindings = await gatherXFindings(admin, organizationId, org?.name ?? "this organization", locations ?? []);

    const prompt = buildPrompt(
      org?.name ?? "this organization",
      org?.threat_context ?? null,
      locations ?? [],
      incidents ?? [],
      watchlist ?? [],
      xFindings,
    );

    const tools: Anthropic.Messages.ToolUnion[] = [{ type: "web_search_20260209", name: "web_search" }];
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

    // Join with "" not "\n\n": with a server-side tool like web_search, a
    // single response's content interleaves several text blocks with the
    // tool calls themselves (one block ends right where the model pauses to
    // search, the next continues after) — these are fragments of one
    // continuous piece of writing, not separate paragraphs. Forcing a
    // paragraph break at every fragment boundary put a spurious blank line
    // after whatever word or punctuation happened to precede a search call.
    // Each block already carries whatever whitespace the model intended.
    const summary = response.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    const { data: report, error } = await admin
      .from("threat_reports")
      .update({
        summary,
        status: "draft",
        source_refs: {
          incident_report_ids: (incidents ?? []).map((incident) => incident.id),
          watchlist_entry_ids: (watchlist ?? []).map((entry) => entry.id),
          location_ids: locationIds,
        },
      })
      .eq("id", placeholder.id)
      .select()
      .single();

    if (error) throw error;
    return report;
  } catch (err) {
    // Don't leave a dead "generating" row occupying this organization's
    // weekly slot — a failed attempt shouldn't block the next real one.
    await admin.from("threat_reports").delete().eq("id", placeholder.id);
    throw err;
  }
}
