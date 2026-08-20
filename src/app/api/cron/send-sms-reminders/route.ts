import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendShiftReminders } from "@/lib/smsReminders";

// Triggered daily by Vercel Cron (see vercel.json), same auth pattern as
// generate-events — walks every organization in one pass. Sends are now
// throttled to SignalWire's 1 msg/sec limit (see smsReminders.ts), so a
// large batch needs real headroom — 300s covers roughly 270 reminders in
// one run, matching the budget already used for other longer jobs.
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await sendShiftReminders(admin);

  return NextResponse.json({ ok: true, ...result });
}
