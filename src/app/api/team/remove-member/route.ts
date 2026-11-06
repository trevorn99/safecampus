import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Removing someone from an organization. Hard delete of the member row,
// which cascades to everything that row owns: role assignments, event
// assignments, regulars, attendance, certifications, background checks and
// training records. What they authored — incident reports, documents —
// survives with the author left null, so removing a person never erases the
// organization's own records.
//
// A route rather than a client-side delete. RLS does enforce org_admin, but
// a DELETE that RLS disallows is not an error: it succeeds having matched
// zero rows, so the browser sees success and the row is simply still there
// after the refresh. The delete below checks what it actually matched, and
// the last-admin guard needs a server-side count regardless.
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

  const { data: target } = await supabase
    .from("members")
    .select("id, name, user_id, organization_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: target.organization_id });
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // An organization with no org_admin cannot be administered by anyone, and
  // nothing in the app can appoint one — is_org_admin() gates the very
  // screens that grant the role. Deleting the last one is unrecoverable
  // without database access, so it is refused here rather than explained
  // afterwards.
  const { data: admins, error: adminsError } = await supabase
    .from("role_assignments")
    .select("member_id")
    .eq("scope_type", "org")
    .eq("scope_id", target.organization_id)
    .eq("role", "org_admin");

  if (adminsError) {
    return NextResponse.json({ error: adminsError.message }, { status: 400 });
  }

  const adminMemberIds = new Set((admins ?? []).map((row) => row.member_id));
  if (adminMemberIds.has(target.id) && adminMemberIds.size <= 1) {
    return NextResponse.json(
      {
        error:
          "This is the organization's only administrator. Make someone else an administrator first, otherwise nobody would be able to manage the organization.",
      },
      { status: 409 },
    );
  }

  // .select() is the point: without it a row blocked by RLS reports success
  // with nothing deleted.
  const { data: deleted, error: deleteError } = await supabase
    .from("members")
    .delete()
    .eq("id", target.id)
    .select("id");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      { error: "That member couldn't be removed. Refresh the page and try again." },
      { status: 409 },
    );
  }

  // Their sign-in account is deliberately left alone: it is per-project, not
  // per-organization, so deleting it would also remove them from any other
  // organization they belong to. With no member row left they simply have
  // no access here.
  return NextResponse.json({ ok: true, removed: target.name, self: target.user_id === user.id });
}
