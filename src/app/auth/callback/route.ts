import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncPlanTier } from "@/lib/billing";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        return NextResponse.redirect(`${origin}/auth/mfa-challenge`);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: membership } = await supabase
        .from("members")
        .select("id, status, organization_id")
        .eq("user_id", user?.id ?? "")
        .maybeSingle();

      if (membership && membership.status === "pending") {
        await supabase.from("members").update({ status: "active" }).eq("id", membership.id);
        await syncPlanTier(membership.organization_id);
      }

      return NextResponse.redirect(`${origin}${membership ? "/dashboard" : "/onboarding"}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
