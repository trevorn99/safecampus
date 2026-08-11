import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: member.organization_id });
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { enabled } = await request.json();

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ sms_enabled: Boolean(enabled) })
    .eq("id", member.organization_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
