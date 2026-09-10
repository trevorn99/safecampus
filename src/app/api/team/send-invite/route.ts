import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Invites someone who's already on the roster — the second half of adding a
// member without inviting them (/api/team/invite with sendInvite: false).
// Their teams and their existing position assignments are untouched; this
// only creates the account their row will link to.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { memberId } = await request.json();
  if (!memberId) {
    return NextResponse.json({ error: "Missing member" }, { status: 400 });
  }

  // The org-wide read policy scopes this to the caller's own organization,
  // and is_org_admin() below confirms they're allowed to act on it.
  const { data: target } = await supabase
    .from("members")
    .select("id, email, user_id, organization_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: target.organization_id });
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!target.email) {
    return NextResponse.json({ error: "Add an email address to this member first" }, { status: 400 });
  }
  if (target.user_id) {
    return NextResponse.json({ error: "This member has already been invited" }, { status: 409 });
  }

  const origin = new URL(request.url).origin;
  const admin = createAdminClient();

  // Same metadata as /api/team/invite, for the same reason — the invite
  // template has no other way to name the organization.
  const { data: inviteOrg } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", target.organization_id)
    .maybeSingle();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(target.email, {
    redirectTo: `${origin}/auth/callback`,
    data: { organization_name: inviteOrg?.name ?? null },
  });

  if (inviteError) {
    // The common failure here is an address that already has a SafeCampus
    // account — someone who signed in on their own before the org got around
    // to inviting them. Nothing to fix: their next sign-in claims this row by
    // email (lib/claimMembership.ts), assignments and all.
    return NextResponse.json(
      {
        error: `Couldn't send the invite: ${inviteError.message}. If they already have an account, they'll be linked to this roster entry the next time they sign in.`,
      },
      { status: 502 },
    );
  }

  const { error: linkError } = await supabase
    .from("members")
    .update({ user_id: invited.user.id })
    .eq("id", target.id);
  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
