import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEventCreated } from "@/lib/eventNotifications";

// Announces a newly created event to the people expected to work it. Sends
// one message per recipient rather than one with many recipients, so each
// carries its own unsubscribe link and nobody sees anyone else's address.
export const maxDuration = 300;

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

  // Read under the caller's own session first: RLS refuses an event outside
  // their organization before the service-role client is involved at all.
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

  const origin = new URL(request.url).origin;
  const result = await notifyEventCreated(createAdminClient(), event.organization_id, eventId, origin);

  return NextResponse.json({ ok: true, ...result });
}
