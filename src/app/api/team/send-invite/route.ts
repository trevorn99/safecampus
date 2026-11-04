import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, renderBrandedEmail, sendEmail } from "@/lib/email";

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

  // organization_name rides along in user_metadata so Supabase's invite
  // template can say who is inviting them — see
  // supabase/email-templates/invite.html, which reads {{ .Data.organization_name }}.
  // Auth is per-project, not per-org, so this metadata is the only way the
  // template can know.
  const { data: inviteOrg } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", target.organization_id)
    .maybeSingle();
  const orgName = inviteOrg?.name ?? "your organization";

  // Already invited: Supabase won't invite an address that has an account,
  // so a resend can't go through inviteUserByEmail. It used to be refused
  // outright — which left an admin watching "Invite pending" forever with no
  // way to help someone whose invitation went to spam. generateLink mints a
  // fresh sign-in link without sending anything, so it goes out through our
  // own branded email instead of Supabase's template.
  if (target.user_id) {
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: target.email,
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (linkError || !link?.properties?.action_link) {
      return NextResponse.json(
        { error: `Couldn't create a new sign-in link: ${linkError?.message ?? "no link returned"}` },
        { status: 502 },
      );
    }

    const actionLink = link.properties.action_link;
    const result = await sendEmail({
      to: target.email,
      subject: `Your invitation to ${orgName} on SafeCampus`,
      text: [
        orgName,
        "",
        `${orgName} invited you to join their safety team on SafeCampus.`,
        "",
        `Sign in here: ${actionLink}`,
        "",
        "This link works once. If it has expired, ask an admin to send another.",
      ].join("\n"),
      html: renderBrandedEmail({
        origin,
        eyebrow: orgName,
        bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.5;color:#1c2430">${escapeHtml(orgName)} invited you to join their safety team on SafeCampus.</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#5b6670">There&rsquo;s no password to choose — this link signs you straight in.</p>`,
        cta: { label: "Sign in to SafeCampus", url: actionLink },
        footerHtml: `This link works once. If it has expired, ask an admin to send another.`,
      }),
    });

    if (!result.ok) {
      return NextResponse.json({ error: `Couldn't send the invitation: ${result.error}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, resent: true });
  }

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
