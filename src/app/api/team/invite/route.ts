import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { organizationId, email, name, role, scopeType, scopeId, sendInvite = true } = await request.json();

  if (!organizationId || !name || !role || !scopeType || !scopeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Stored lowercase so sign-in can match on it directly — see
  // lib/claimMembership.ts, which links this row to a real account by
  // address and can't use a case-insensitive comparison safely.
  const normalizedEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;

  // An invite has to go somewhere; a roster-only entry doesn't. Someone
  // added without an address can still be scheduled, they just can't be
  // linked to an account until an admin fills one in.
  if (sendInvite && !normalizedEmail) {
    return NextResponse.json({ error: "An email address is required to send an invite" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (normalizedEmail) {
    const { data: existing } = await supabase
      .from("members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Someone with that email is already on this roster" }, { status: 409 });
    }
  }

  // Inserted under the caller's own session first, on purpose: RLS rejects
  // this outright if they aren't an org_admin, before the service_role
  // client (which bypasses RLS) ever gets involved.
  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({ organization_id: organizationId, name, email: normalizedEmail, status: "pending" })
    .select("id")
    .single();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 403 });
  }

  const { error: roleError } = await supabase
    .from("role_assignments")
    .insert({ member_id: member.id, scope_type: scopeType, scope_id: scopeId, role });

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 400 });
  }

  // Roster-only: the row exists, can be put on teams and assigned to
  // positions immediately, and stays unlinked (user_id null) until either an
  // admin sends the invite later (/api/team/send-invite) or the person signs
  // in themselves and claims it by email.
  if (!sendInvite) {
    return NextResponse.json({ ok: true, invited: false });
  }

  const origin = new URL(request.url).origin;
  const admin = createAdminClient();

  // organization_name rides along in user_metadata so Supabase's invite
  // template can say who is inviting them — see
  // supabase/email-templates/invite.html, which reads {{ .Data.organization_name }}.
  // Auth is per-project, not per-org, so this metadata is the only way the
  // template can know.
  const { data: inviteOrg } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail!, {
    redirectTo: `${origin}/auth/callback`,
    data: { organization_name: inviteOrg?.name ?? null },
  });

  if (inviteError) {
    return NextResponse.json(
      { error: `Member record created, but the invite email failed to send: ${inviteError.message}` },
      { status: 502 },
    );
  }

  await supabase.from("members").update({ user_id: invited.user.id }).eq("id", member.id);

  return NextResponse.json({ ok: true, invited: true });
}
