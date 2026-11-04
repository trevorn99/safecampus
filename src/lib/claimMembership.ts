import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// An org can add someone to the roster and schedule them before they have
// an account at all (/api/team/invite with sendInvite: false). That leaves a
// members row with user_id null — already holding their team memberships and
// position assignments — waiting for the person to show up.
//
// This is where they get connected: the first time someone signs in with no
// membership of their own, an unclaimed row carrying their email address
// becomes theirs, assignments and all.
export async function claimUnlinkedMembership(
  admin: SupabaseClient,
  userId: string,
  email: string | null | undefined,
): Promise<{ id: string; organization_id: string } | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;

  // Service-role: the row has no user_id yet, so it isn't inside any org
  // this session can see — "read own org roster" is keyed on the caller's
  // own memberships, and they have none.
  //
  // Deliberately fetches more than one. A single row is the answer; several
  // means two organisations have each pre-added this address, and there is
  // nothing in a sign-in to say which one the person meant.
  const { data: candidates } = await admin
    .from("members")
    .select("id, organization_id")
    .is("user_id", null)
    .eq("email", normalized)
    .order("created_at", { ascending: true })
    .limit(2);

  // Ambiguous: claim nothing rather than the oldest. Guessing puts someone
  // inside an organisation they may have no connection to, with sight of its
  // roster and schedule — a wrong guess here is a data-exposure bug, not an
  // inconvenience. They land on /onboarding instead, and an admin can invite
  // them directly, which names the organisation unambiguously.
  if (!candidates || candidates.length !== 1) return null;

  const match = candidates[0];

  // The `.is("user_id", null)` guard is repeated on the update so two
  // simultaneous sign-ins can't both claim the same row.
  const { data: claimed } = await admin
    .from("members")
    .update({ user_id: userId, status: "active" })
    .eq("id", match.id)
    .is("user_id", null)
    .select("id, organization_id")
    .maybeSingle();

  return claimed ?? null;
}
