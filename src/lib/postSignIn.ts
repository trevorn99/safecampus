import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimUnlinkedMembership } from "@/lib/claimMembership";
import { syncPlanTier } from "@/lib/billing";
import { isTrustedDeviceRequest } from "@/lib/trustedDevice";

// Everything that has to happen once a session exists, shared by the two
// ways one can be established: the OAuth/PKCE code exchange in
// /auth/callback, and the email-link verification in /auth/confirm.
//
// It lives here because the two drifting apart is a security problem rather
// than a cosmetic one — a second entry point that forgot the MFA step would
// be a way around MFA, and one that forgot the roster claim would drop a
// new member onto /onboarding to create a duplicate organization.
export async function resolveSignedInRedirect(
  supabase: SupabaseClient,
  origin: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A verified email link or code only ever buys aal1. Anyone enrolled in
  // MFA still owes a factor before they reach anything, unless this device
  // was trusted within the window in lib/mfaTrust.ts.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const trusted = user ? await isTrustedDeviceRequest(user.id) : false;
    if (!trusted) {
      return `${origin}/auth/mfa-challenge`;
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

  // Nothing linked to this account yet — but an org may have added them to
  // its roster (and scheduled them) before they ever signed in. That row is
  // matched by email and becomes theirs here, so they land on the dashboard
  // with their assignments intact instead of being sent to /onboarding to
  // create a second organization.
  let claimed: { organization_id: string } | null = null;
  if (!membership && user) {
    claimed = await claimUnlinkedMembership(createAdminClient(), user.id, user.email);
    if (claimed) {
      await syncPlanTier(claimed.organization_id);
    }
  }

  return `${origin}${membership || claimed ? "/dashboard" : "/onboarding"}`;
}
