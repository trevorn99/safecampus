import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_HOURS = 24;

export async function POST(request: Request) {
  const { organizationId, reason, hours } = await request.json();
  const durationHours = Number(hours);

  if (!organizationId || !reason?.trim() || !Number.isFinite(durationHours)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (durationHours <= 0 || durationHours > MAX_HOURS) {
    return NextResponse.json({ error: `Duration must be between 1 and ${MAX_HOURS} hours` }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (!isPlatformAdmin) {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  const { error } = await admin.from("support_access_grants").insert({
    organization_id: organizationId,
    platform_admin_id: user.id,
    reason: reason.trim(),
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
