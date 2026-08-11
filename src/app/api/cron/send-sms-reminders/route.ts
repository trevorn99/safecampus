import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendShiftReminders } from "@/lib/smsReminders";

// Triggered daily by Vercel Cron (see vercel.json), same auth pattern as
// generate-events — walks every organization in one pass.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await sendShiftReminders(admin);

  return NextResponse.json({ ok: true, ...result });
}
