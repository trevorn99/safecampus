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
  const { data: candidates } = await admin
    .from("members")
    .select("id, organization_id")
    .is("user_id", null)
    .eq("email", normalized)
    .order("created_at", { ascending: true })
    .limit(1);

  const match = candidates?.[0];
  if (!match) return null;

  // Only ever one row, even if two orgs pre-added the same person: the app
  // treats a user as belonging to a single organization (session.ts looks
  // membership up with maybeSingle()), so claiming both would break every
  // page instead of being a feature. The other org's row stays unclaimed
  // and keeps working as a roster entry.
  //
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
