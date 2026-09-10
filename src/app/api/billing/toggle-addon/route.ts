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
    .select("stripe_subscription_id, paywall_exempt")
    .eq("id", member.organization_id)
    .single();

  const admin = createAdminClient();

  // A comped org has no subscription to hang an add-on item off, so there is
  // nothing for Stripe to do — being exempt from the paywall means being
  // exempt from the add-on charge too. The column is still the only thing
  // that gates the feature, so it's written exactly as it is for a paying
  // org, and the weekly cron picks the org up the same way.
  //
  // Deliberately still a toggle rather than implied by paywall_exempt:
  // Threat Intelligence costs real money per report (Claude, plus X reads),
  // so switching it on for an org stays a decision someone makes, and
  // Identity Verification would otherwise start forcing ID checks on every
  // member of every comped org.
  if (org?.paywall_exempt) {
    const { error } = await admin
      .from("organizations")
      .update({ [addonConfig.column]: Boolean(enabled) })
      .eq("id", member.organization_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, billed: false });
  }

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

  await admin
    .from("organizations")
    .update({ [addonConfig.column]: Boolean(enabled) })
    .eq("id", member.organization_id);

  return NextResponse.json({ ok: true, billed: true });
}
