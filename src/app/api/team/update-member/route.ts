import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Corrects a member's name or email. Goes through a route rather than
// straight from the browser so the per-organisation duplicate check that
// /api/team/invite applies at creation is applied here too — nothing in the
// database enforces it, so an edit could otherwise create the collision the
// invite form refuses.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { memberId, name, email } = await request.json();
  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!memberId || !trimmedName) {
    return NextResponse.json({ error: "A name is required" }, { status: 400 });
  }

  // Lowercased to match how the invite route stores it and how sign-in
  // claims an unlinked row — a capitalised edit would quietly stop matching.
  const normalizedEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;

  const { data: target } = await supabase
    .from("members")
    .select("id, organization_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: target.organization_id });
  if (!isAdmin) {
    return NextResponse.json({ error: "Org admin required" }, { status: 403 });
  }

  if (normalizedEmail) {
    const { data: clash } = await supabase
      .from("members")
      .select("id")
      .eq("organization_id", target.organization_id)
      .eq("email", normalizedEmail)
      .neq("id", memberId)
      .maybeSingle();
    if (clash) {
      return NextResponse.json({ error: "Someone else on this roster already has that email" }, { status: 409 });
    }
  }

  // Under the caller's own session: "update own profile or admin" is what
  // actually authorises this, and the is_org_admin check above is so the
  // refusal is a readable message rather than a silent zero-row update.
  const { data: updated, error } = await supabase
    .from("members")
    .update({ name: trimmedName, email: normalizedEmail })
    .eq("id", memberId)
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "That didn't save — you may not have permission." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
