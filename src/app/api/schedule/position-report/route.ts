import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPositionReportOnDemand } from "@/lib/eventPositionReports";

// Emails the requesting org admin a position report for one event, now,
// rather than waiting for the scheduled run three days out. Always to the
// caller's own address — an endpoint that mails a report about who is working
// to any address you name is a data-disclosure route, not a convenience.
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { eventId } = await request.json();
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  // Read under the caller's own session first, so RLS refuses an event
  // outside their organization before the service-role client is involved.
  const { data: event } = await supabase
    .from("events")
    .select("id, organization_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: event.organization_id });
  if (!isAdmin) {
    return NextResponse.json({ error: "Org admin required" }, { status: 403 });
  }

  const { data: member } = await supabase.from("members").select("id").eq("user_id", user.id).maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const result = await sendPositionReportOnDemand(createAdminClient(), eventId, member.id, origin);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
