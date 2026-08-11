import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// organizations has no client update policy at all, so this org-wide "about
// us" context (fed into every location's Threat Intelligence prompt) goes
// through a service-role route gated by is_org_admin, same pattern as
// toggle-sms/toggle-addon.
export async function POST(request: Request) {
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

  const { threatContext } = await request.json();

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ threat_context: typeof threatContext === "string" ? threatContext.trim() || null : null })
    .eq("id", member.organization_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
