import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateThreatReport, getGenerationStatus } from "@/lib/threatIntelligence";

// Generation itself can take a while — Claude Opus 5 thinking, several web
// searches for protest/advisory info, and possibly a few pause_turn resumes
// — well past a default serverless timeout.
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const { data: location } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("organization_id", member.organization_id)
    .maybeSingle();
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: canManage } = await supabase.rpc("is_location_manager", { target_location: locationId });
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("threat_intel_enabled")
    .eq("id", member.organization_id)
    .single();
  if (!org?.threat_intel_enabled) {
    return NextResponse.json({ error: "Threat Intelligence is not enabled for this organization" }, { status: 400 });
  }

  const admin = createAdminClient();

  const status = await getGenerationStatus(admin, locationId);
  if (status.state === "generating") {
    return NextResponse.json(
      { error: "A report is already being generated for this location — check back in a few minutes." },
      { status: 429 },
    );
  }
  if (status.state === "cooldown") {
    return NextResponse.json(
      {
        error: `Only one report per week — the next one can be generated on ${status.nextEligibleAt.toLocaleDateString()}.`,
      },
      { status: 429 },
    );
  }

  const report = await generateThreatReport(admin, locationId);

  return NextResponse.json({ ok: true, report });
}
