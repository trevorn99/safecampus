import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { organizationId, days } = await request.json();
  if (!organizationId || typeof days !== "number" || !Number.isFinite(days) || days <= 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

  const admin = createAdminClient();
  const { data: org, error: fetchError } = await admin
    .from("organizations")
    .select("trial_ends_at")
    .eq("id", organizationId)
    .single();
  if (fetchError || !org) {
    return NextResponse.json({ error: fetchError?.message ?? "Organization not found" }, { status: 400 });
  }

  // Extends from whichever is later — "now" or the existing end date — so
  // this never loses time already remaining on a trial that hasn't expired
  // yet, but also doesn't compound onto a long-expired date for an org
  // that's already locked out.
  const base = Math.max(Date.now(), new Date(org.trial_ends_at).getTime());
  const trialEndsAt = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("organizations").update({ trial_ends_at: trialEndsAt }).eq("id", organizationId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, trialEndsAt });
}
