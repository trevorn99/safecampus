import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInviteEmail } from "@/lib/inviteEmail";

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

  const origin = new URL(request.url).origin;
  const admin = createAdminClient();

  const { data: inviteOrg } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", target.organization_id)
    .maybeSingle();

  // Someone already invited can't be invited again — Supabase refuses an
  // address that has an account — so a resend mints a fresh magic link
  // instead. It used to be refused outright, which left an admin watching
  // "Invite pending" forever with no way to help someone whose invitation
  // went to spam.
  //
  // Both kinds send the identical message from lib/inviteEmail.ts: a resend
  // that looked nothing like the first invitation was no reassurance to
  // someone trying to work out whether either was genuine.
  const resend = Boolean(target.user_id);
  const sent = await sendInviteEmail({
    admin,
    origin,
    orgName: inviteOrg?.name,
    email: target.email,
    kind: resend ? "magiclink" : "invite",
  });

  // The auth account exists as soon as the link is minted, so link it to the
  // member row even when the mail then failed — otherwise the row stays
  // unlinked and every later resend hits the "already has an account" wall.
  if (!resend && !sent.ok && sent.stage === "send" && sent.userId) {
    await supabase.from("members").update({ user_id: sent.userId }).eq("id", target.id);
  }

  if (!sent.ok) {
    if (sent.stage === "link") {
      return NextResponse.json(
        {
          error: resend
            ? `Couldn't create a new sign-in link: ${sent.error}`
            : // The common failure here is an address that already has a
              // SafeCampus account — someone who signed in on their own
              // before the org got around to inviting them. Nothing to fix:
              // their next sign-in claims this row by email
              // (lib/claimMembership.ts), assignments and all.
              `Couldn't send the invite: ${sent.error}. If they already have an account, they'll be linked to this roster entry the next time they sign in.`,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: `Couldn't send the invitation: ${sent.error}` }, { status: 502 });
  }

  if (!resend && sent.userId) {
    const { error: linkError } = await supabase
      .from("members")
      .update({ user_id: sent.userId })
      .eq("id", target.id);
    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, resent: resend });
}
