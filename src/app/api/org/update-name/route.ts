import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// organizations has no client update policy at all, so renaming the org
// goes through a service-role route gated by is_org_admin, same pattern as
// toggle-sms/toggle-addon/update-threat-context.
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

  const { name } = await request.json();
  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) {
    return NextResponse.json({ error: "Organization name can't be empty" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ name: trimmedName })
    .eq("id", member.organization_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
