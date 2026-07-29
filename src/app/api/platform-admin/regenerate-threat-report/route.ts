import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateThreatReport } from "@/lib/threatIntelligence";

// Lets a platform admin force a fresh report outside the normal one-per-week
// cap — for troubleshooting a customer-reported problem, not routine use.
// Gated the same way as the rest of the per-org support console: a live,
// self-granted support_access_grants row for this exact org.
export const maxDuration = 180;

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

  const { locationId } = await request.json();
  if (typeof locationId !== "string" || !locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: location } = await admin
    .from("locations")
    .select("organization_id")
    .eq("id", locationId)
    .maybeSingle();
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: hasGrant } = await supabase.rpc("has_active_support_grant", {
    target_org: location.organization_id,
  });
  if (!hasGrant) {
    return NextResponse.json({ error: "No active support access grant for this organization" }, { status: 403 });
  }

  const report = await generateThreatReport(admin, locationId);

  return NextResponse.json({ ok: true, report });
}
