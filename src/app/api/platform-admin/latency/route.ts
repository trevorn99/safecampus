import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Times the Supabase calls a normal page makes, from inside the serverless
// function — which is the only network path that matters. Measuring from a
// laptop mixes in home-broadband latency to a different continent; this runs
// in the same region as the database.
//
// Each label is a real call from the request path, not a synthetic one:
// getUser is made twice per page (once by the proxy, once by
// requireMembership), and the rpc batch is what gates every page render.
export async function GET() {
  const supabase = await createClient();

  // PromiseLike, not Promise: Supabase's query builders are thenable but
  // don't implement catch/finally, so they don't satisfy Promise<T>.
  async function time(label: string, run: () => PromiseLike<unknown>): Promise<{ label: string; ms: number }> {
    const started = Date.now();
    await run();
    return { label, ms: Date.now() - started };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (!isPlatformAdmin) {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const timings = [
    await time("auth.getUser", () => supabase.auth.getUser()),
    await time("members by user_id", () =>
      supabase.from("members").select("id, organization_id").eq("user_id", user.id).maybeSingle(),
    ),
    await time("rpc is_org_admin", () =>
      supabase.rpc("is_org_admin", { target_org: member?.organization_id ?? user.id }),
    ),
    await time("rpc has_active_access", () =>
      supabase.rpc("has_active_access", { target_org: member?.organization_id ?? user.id }),
    ),
    await time("organizations by id", () =>
      supabase.from("organizations").select("name").eq("id", member?.organization_id ?? user.id).maybeSingle(),
    ),
    await time("auth.mfa.listFactors", () => supabase.auth.mfa.listFactors()),
  ];

  return NextResponse.json({
    // Vercel sets this to the region the function ran in. If it isn't the
    // same region as the Supabase project, every round trip above is paying
    // a cross-region hop it doesn't need to.
    functionRegion: process.env.VERCEL_REGION ?? "unknown",
    timings,
    totalMs: timings.reduce((sum, t) => sum + t.ms, 0),
  });
}
