import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { clientId, clientSecret } = await request.json();
  if (!clientId?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: member.organization_id });
  if (!isAdmin) {
    return NextResponse.json({ error: "Org admin required" }, { status: 403 });
  }

  const admin = createAdminClient();

  // The secret field is only shown as a placeholder once saved, never
  // re-populated in the form — leaving it blank on an update keeps the
  // existing secret rather than clearing it.
  let secretToStore: string | undefined = clientSecret?.trim() || undefined;
  if (!secretToStore) {
    const { data: existing } = await admin
      .from("pco_app_credentials")
      .select("client_secret")
      .eq("organization_id", member.organization_id)
      .maybeSingle();
    secretToStore = existing?.client_secret;
  }
  if (!secretToStore) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { error } = await admin.from("pco_app_credentials").upsert(
    {
      organization_id: member.organization_id,
      client_id: clientId.trim(),
      client_secret: secretToStore,
      saved_by: member.id,
    },
    { onConflict: "organization_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
