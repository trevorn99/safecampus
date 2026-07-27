import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/billing";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", {
    target_org: member.organization_id,
  });
  if (!isAdmin) {
    return NextResponse.json({ error: "Org admin required" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_subscription_id")
    .eq("id", member.organization_id)
    .single();

  if (!org?.stripe_subscription_id) {
    return NextResponse.json({ error: "No subscription to sync yet" }, { status: 400 });
  }

  const stripe = createStripeClient();
  const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
  await syncSubscriptionFromStripe(subscription);

  return NextResponse.json({ ok: true });
}
