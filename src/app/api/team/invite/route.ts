import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  const { organizationId, email, name, role, scopeType, scopeId } = await request.json();

  if (!organizationId || !email || !name || !role || !scopeType || !scopeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Inserted under the caller's own session first, on purpose: RLS rejects
  // this outright if they aren't an org_admin, before the service_role
  // client (which bypasses RLS) ever gets involved.
  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({ organization_id: organizationId, name, email, status: "pending" })
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

  const origin = new URL(request.url).origin;
  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });

  if (inviteError) {
    return NextResponse.json(
      { error: `Member record created, but the invite email failed to send: ${inviteError.message}` },
      { status: 502 },
    );
  }

  await supabase.from("members").update({ user_id: invited.user.id }).eq("id", member.id);

  await syncSeatQuantity(organizationId, admin);

  return NextResponse.json({ ok: true });
}

// Per-seat billing: keep the Stripe subscription's quantity matched to
// active member count whenever the roster grows. Only orgs with an existing
// subscription need this — trialing/exempt orgs have no subscription yet.
async function syncSeatQuantity(organizationId: string, admin: ReturnType<typeof createAdminClient>) {
  const { data: org } = await admin
    .from("organizations")
    .select("stripe_subscription_id")
    .eq("id", organizationId)
    .single();
  if (!org?.stripe_subscription_id) return;

  const { count } = await admin
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active");

  const stripe = createStripeClient();
  const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
  const item = subscription.items.data[0];
  if (item) {
    await stripe.subscriptionItems.update(item.id, { quantity: Math.max(count ?? 1, 1) });
  }
}
