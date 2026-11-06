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
export type SignInMethod = "email_code" | "email_link" | "google";

// For the sign-in history on Analytics (member_sign_ins). Best effort by
// design: a failure here is logged and otherwise ignored, because nobody
// should be kept out of the app because a statistic didn't save.
async function recordSignIn(userId: string, method: SignInMethod, organizationId?: string) {
  try {
    const admin = createAdminClient();
    let query = admin.from("members").select("id, organization_id").eq("user_id", userId);
    if (organizationId) query = query.eq("organization_id", organizationId);
    const { data: rows } = await query;
    if (!rows || rows.length === 0) return;
    const { error } = await admin
      .from("member_sign_ins")
      .insert(rows.map((row) => ({ organization_id: row.organization_id, member_id: row.id, method })));
    if (error) console.error("sign-in not recorded", error.message);
  } catch (error) {
    console.error("sign-in not recorded", error);
  }
}

export async function resolveSignedInRedirect(
  supabase: SupabaseClient,
  origin: string,
  method: SignInMethod,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Recorded before the MFA step below, which returns early: a sign-in that
  // still owes a second factor is still a sign-in, and recording after it
  // would leave every MFA user out of the figures.
  if (user) await recordSignIn(user.id, method);

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
      // Unlinked when the sign-in was recorded above, so it wasn't counted.
      await recordSignIn(user.id, method, claimed.organization_id);
    }
  }

  return `${origin}${membership || claimed ? "/dashboard" : "/onboarding"}`;
}
