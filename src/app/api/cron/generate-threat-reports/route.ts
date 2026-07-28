import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateThreatReport, getNextEligibleGenerationDate } from "@/lib/threatIntelligence";

// Triggered weekly by Vercel Cron (see vercel.json) — refreshes every
// location's Threat Intelligence report for orgs with the add-on enabled.
// Report generation is slow (Claude Opus 5 + thinking), so this route can
// run long; keep it well under Vercel's function timeout for the plan.
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: orgs } = await admin.from("organizations").select("id").eq("threat_intel_enabled", true);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const org of orgs ?? []) {
    const { data: locations } = await admin.from("locations").select("id").eq("organization_id", org.id);
    for (const location of locations ?? []) {
      // An admin may have already generated one on demand this week —
      // enforce the same one-per-week cap here rather than doubling up.
      const nextEligibleAt = await getNextEligibleGenerationDate(admin, location.id);
      if (nextEligibleAt) {
        skipped += 1;
        continue;
      }
      try {
        await generateThreatReport(admin, location.id);
        generated += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, organizations: orgs?.length ?? 0, generated, skipped, failed });
}
