import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient, ADDONS, type AddonKey } from "@/lib/stripe";

// Adds/removes an add-on (threat_intel, identity_verification, ...) as a
// second item on the org's existing subscription, rather than a separate
// Checkout session — the org must already be subscribed to a base tier.
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

  const { enabled, addon } = (await request.json()) as { enabled: boolean; addon: AddonKey };
  const addonConfig = ADDONS[addon];
  if (!addonConfig) {
    return NextResponse.json({ error: "Unknown add-on" }, { status: 400 });
  }

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
  const addonItem = subscription.items.data.find((item) => item.price.id === addonConfig.priceId);

  // Default proration ("create_prorations") just queues the prorated amount
  // onto the org's *next* regular invoice — nothing gets billed at the
  // moment they flip the toggle. always_invoice forces Stripe to invoice
  // (and attempt to charge) the prorated amount immediately instead, so
  // enabling this actually bills for it right away.
  if (enabled && !addonItem) {
    await stripe.subscriptionItems.create({
      subscription: org.stripe_subscription_id,
      price: addonConfig.priceId,
      proration_behavior: "always_invoice",
    });
  } else if (!enabled && addonItem) {
    await stripe.subscriptionItems.del(addonItem.id, { proration_behavior: "always_invoice" });
  }

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({ [addonConfig.column]: Boolean(enabled) })
    .eq("id", member.organization_id);

  return NextResponse.json({ ok: true });
}
