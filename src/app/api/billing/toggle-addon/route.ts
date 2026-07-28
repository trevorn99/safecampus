import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient, THREAT_INTEL_PRICE_ID } from "@/lib/stripe";

// Adds/removes the Threat Intelligence add-on as a second item on the org's
// existing subscription, rather than a separate Checkout session — the org
// must already be subscribed to a base tier.
export async function POST(request: Request) {
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

  const { enabled } = await request.json();

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_subscription_id")
    .eq("id", member.organization_id)
    .single();

  if (!org?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "Subscribe to a plan before enabling add-ons." },
      { status: 400 },
    );
  }

  const stripe = createStripeClient();
  const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
  const addonItem = subscription.items.data.find((item) => item.price.id === THREAT_INTEL_PRICE_ID);

  if (enabled && !addonItem) {
    await stripe.subscriptionItems.create({
      subscription: org.stripe_subscription_id,
      price: THREAT_INTEL_PRICE_ID,
    });
  } else if (!enabled && addonItem) {
    await stripe.subscriptionItems.del(addonItem.id);
  }

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({ threat_intel_enabled: Boolean(enabled) })
    .eq("id", member.organization_id);

  return NextResponse.json({ ok: true });
}
