import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateThreatReport, getGenerationStatus } from "@/lib/threatIntelligence";

// Lets a platform admin force a fresh combined report for an org outside
// the normal one-per-week cap — for troubleshooting a customer-reported
// problem, not routine use. Gated the same way as the rest of the per-org
// support console: a live, self-granted support_access_grants row for this
// exact org.
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (!isPlatformAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { organizationId } = await request.json();
  if (typeof organizationId !== "string" || !organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  const { data: hasGrant } = await supabase.rpc("has_active_support_grant", {
    target_org: organizationId,
  });
  if (!hasGrant) {
    return NextResponse.json({ error: "No active support access grant for this organization" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Bypasses the weekly cooldown intentionally (that's the point of this
  // route) but still respects an in-progress generation for this org — a
  // support override shouldn't be able to kick off a second concurrent run
  // on top of one already happening.
  const status = await getGenerationStatus(admin, organizationId);
  if (status.state === "generating") {
    return NextResponse.json(
      { error: "A report is already being generated for this organization — check back in a few minutes." },
      { status: 429 },
    );
  }

  const report = await generateThreatReport(admin, organizationId);

  return NextResponse.json({ ok: true, report });
}
