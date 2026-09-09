import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateThreatReport, getGenerationStatus } from "@/lib/threatIntelligence";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

// Triggered weekly by Vercel Cron (see vercel.json) — refreshes the single
// combined Threat Intelligence report for each org with the add-on enabled
// (one report per organization, covering every location together).
// Generation is slow (Claude Opus 5 + thinking + a search per location), so
// this route can run long; keep it well under Vercel's function timeout.
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: orgs } = await admin.from("organizations").select("id").eq("threat_intel_enabled", true);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const org of orgs ?? []) {
    // An admin may have already generated one on demand this week, or one
    // may still be generating right now — enforce the same status check
    // here rather than doubling up.
    const status = await getGenerationStatus(admin, org.id);
    if (status.state !== "idle") {
      skipped += 1;
      continue;
    }
    try {
      await generateThreatReport(admin, org.id);
      generated += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, organizations: orgs?.length ?? 0, generated, skipped, failed });
}
