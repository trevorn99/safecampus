import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSeriesOccurrences, type EventSeriesRow } from "@/lib/eventSeries";

// On-demand version of the cron job, scoped to a single series so an admin
// gets immediate feedback after creating one instead of waiting for the
// next scheduled run. Uses the caller's own RLS-respecting session — org
// admins already have insert rights on events/event_positions, so no
// service-role client is needed here.
export async function POST(request: Request) {
  const { seriesId } = await request.json();
  if (!seriesId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: series } = await supabase
    .from("event_series")
    .select(
      "id, organization_id, location_id, template_id, title, type, recurrence_rule, first_occurrence_at, duration_minutes",
    )
    .eq("id", seriesId)
    .maybeSingle<EventSeriesRow>();
  if (!series) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: series.organization_id });
  if (!isAdmin) {
    return NextResponse.json({ error: "Org admin required" }, { status: 403 });
  }

  const { created } = await generateSeriesOccurrences(supabase, series);
  return NextResponse.json({ ok: true, eventsCreated: created });
}
