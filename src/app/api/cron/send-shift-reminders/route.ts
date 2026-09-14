import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendShiftReminders } from "@/lib/shiftReminders";
import { sendEventPositionReports } from "@/lib/eventPositionReports";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

// Triggered daily by Vercel Cron (see vercel.json), same auth pattern as
// generate-events — walks every organization in one pass, sending both the
// SMS and the email copy of each due reminder. Texts are throttled to
// SignalWire's 1 msg/sec limit (see shiftReminders.ts), so a large batch
// needs real headroom — 300s covers roughly 270 reminders in one run,
// matching the budget already used for other longer jobs. The email pass
// runs unpaced and adds little to that.
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  // Links in the reminder emails (the event page, the unsubscribe URL) need
  // an absolute origin, and cron requests carry the deployment's own — same
  // trick the invite and billing routes use for their redirect URLs.
  const origin = new URL(request.url).origin;
  const result = await sendShiftReminders(admin, origin);

  // Same run as the reminders, and deliberately so: the report covers the
  // same three-days-out window, so the morning a team is told they're on is
  // the morning the admins are told what's still uncovered. Run after, not
  // alongside — a failure here shouldn't cost anyone their reminder.
  const reports = await sendEventPositionReports(admin, origin);

  return NextResponse.json({ ok: true, ...result, ...reports });
}
