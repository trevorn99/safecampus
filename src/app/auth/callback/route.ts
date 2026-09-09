import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimUnlinkedMembership } from "@/lib/claimMembership";
import { syncPlanTier } from "@/lib/billing";
import { isTrustedDeviceRequest } from "@/lib/trustedDevice";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const trusted = user ? await isTrustedDeviceRequest(user.id) : false;
        if (!trusted) {
          return NextResponse.redirect(`${origin}/auth/mfa-challenge`);
        }
      }

      const { data: membership } = await supabase
        .from("members")
        .select("id, status, organization_id")
        .eq("user_id", user?.id ?? "")
        .maybeSingle();

      if (membership && membership.status === "pending") {
        await supabase.from("members").update({ status: "active" }).eq("id", membership.id);
        await syncPlanTier(membership.organization_id);
      }

      // Nothing linked to this account yet — but an org may have added them
      // to its roster (and scheduled them) before they ever signed in. That
      // row is matched by email and becomes theirs here, so they land on the
      // dashboard with their assignments intact instead of being sent to
      // /onboarding to create a second organization.
      let claimed: { organization_id: string } | null = null;
      if (!membership && user) {
        claimed = await claimUnlinkedMembership(createAdminClient(), user.id, user.email);
        if (claimed) {
          await syncPlanTier(claimed.organization_id);
        }
      }

      return NextResponse.redirect(`${origin}${membership || claimed ? "/dashboard" : "/onboarding"}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
