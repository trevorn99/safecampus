import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSeriesOccurrences, type EventSeriesRow } from "@/lib/eventSeries";

// Triggered daily by Vercel Cron (see vercel.json). Vercel signs scheduled
// requests with this bearer token automatically when CRON_SECRET is set —
// this route intentionally has no per-org scoping, since it walks every
// active series across every organization in one pass.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: seriesList } = await admin
    .from("event_series")
    .select("id, organization_id, location_id, template_id, title, type, recurrence_rule, first_occurrence_at")
    .eq("active", true)
    .returns<EventSeriesRow[]>();

  let eventsCreated = 0;
  for (const series of seriesList ?? []) {
    const { created } = await generateSeriesOccurrences(admin, series);
    eventsCreated += created;
  }

  return NextResponse.json({ ok: true, seriesProcessed: seriesList?.length ?? 0, eventsCreated });
}
