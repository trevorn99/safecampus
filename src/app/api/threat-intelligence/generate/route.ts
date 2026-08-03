import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateThreatReport, getGenerationStatus } from "@/lib/threatIntelligence";

// Generation itself can take a while — Claude Opus 5 thinking, a web search
// per location plus DHS/FBI/CISA checks, and possibly a few pause_turn
// resumes — well past a default serverless timeout.
export const maxDuration = 300;

export async function POST() {
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

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: member.organization_id });
  if (!isAdmin) {
    return NextResponse.json({ error: "Org admin required" }, { status: 403 });
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

  const status = await getGenerationStatus(admin, member.organization_id);
  if (status.state === "generating") {
    return NextResponse.json(
      { error: "A report is already being generated for this organization — check back in a few minutes." },
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

  const report = await generateThreatReport(admin, member.organization_id);

  return NextResponse.json({ ok: true, report });
}
