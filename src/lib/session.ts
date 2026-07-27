import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireMembership(options?: { allowUnpaid?: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Safety net for any session that reached a protected page without going
  // through /auth/callback's own check (e.g. a long-lived cookie).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect("/auth/mfa-challenge");
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, name, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    redirect("/onboarding");
  }

  const [
    { data: isAdmin },
    { data: organization },
    { data: privilegedRole },
    { data: hasAccess },
    { data: isPlatformAdmin },
  ] = await Promise.all([
    supabase.rpc("is_org_admin", { target_org: member.organization_id }),
    supabase.from("organizations").select("name").eq("id", member.organization_id).single(),
    supabase
      .from("role_assignments")
      .select("id")
      .eq("member_id", member.id)
      .in("role", ["org_admin", "location_manager"])
      .limit(1)
      .maybeSingle(),
    supabase.rpc("has_active_access", { target_org: member.organization_id }),
    supabase.rpc("is_platform_admin"),
  ]);

  // Every page but /billing itself is gated on an active subscription, trial,
  // or a platform-admin exemption — see has_active_access() in the billing
  // migration.
  if (!hasAccess && !options?.allowUnpaid) {
    redirect("/billing");
  }

  // MFA is required for admin/location_manager accounts — enforced here
  // (app-level) and, for the watchlist specifically, again at the RLS
  // layer via is_aal2() so it holds even against direct API calls.
  if (privilegedRole) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    // data.totp is already filtered to verified factors by the API.
    if (!factors?.totp?.length) {
      redirect("/account/mfa");
    }
  }

  return {
    supabase,
    user,
    member,
    organizationName: organization?.name ?? "Your organization",
    isAdmin: Boolean(isAdmin),
    isPlatformAdmin: Boolean(isPlatformAdmin),
  };
}
