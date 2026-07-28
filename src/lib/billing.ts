import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createStripeClient,
  tierForSeatCount,
  priceIdToTier,
  TIER_PRICE_IDS,
  THREAT_INTEL_PRICE_ID,
} from "@/lib/stripe";

// Stripe subscription statuses collapsed onto organizations.subscription_status.
const STATUS_MAP: Record<Stripe.Subscription.Status, string> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  unpaid: "past_due",
  paused: "canceled",
};

// Shared by the webhook (event-driven) and the manual "sync now" action on
// /billing (on-demand fallback for whenever a webhook event is delayed,
// missed, or — as happened once — blocked entirely by Deployment Protection).
export async function syncSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata.organization_id;
  if (!organizationId) return;

  // Subscriptions can carry more than one item (base tier + the threat-intel
  // add-on), so find each by its price rather than assuming position — keeps
  // plan_tier correct even if a price was changed directly in the Stripe
  // dashboard rather than through syncPlanTier()'s auto-upgrade path.
  const items = subscription.items.data;
  const tier = priceIdToTier(items.find((item) => priceIdToTier(item.price.id))?.price.id);
  const threatIntelEnabled = items.some((item) => item.price.id === THREAT_INTEL_PRICE_ID);

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: STATUS_MAP[subscription.status] ?? "incomplete",
      threat_intel_enabled: threatIntelEnabled,
      ...(tier ? { plan_tier: tier } : {}),
    })
    .eq("id", organizationId);
}

// Called whenever a member's status flips to "active" (accepting an
// invite, or being the founding admin). Active member count is the only
// thing that ever changes an org's tier — pending invites are free.
export async function syncPlanTier(organizationId: string) {
  const admin = createAdminClient();

  const [{ count }, { data: org }] = await Promise.all([
    admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active"),
    admin
      .from("organizations")
      .select("stripe_subscription_id, plan_tier")
      .eq("id", organizationId)
      .single(),
  ]);

  const tier = tierForSeatCount(count ?? 1);
  // No tier covers this many seats (over 50) — needs a manually arranged
  // plan, so leave the existing subscription/tier alone rather than guess.
  if (!tier || tier === org?.plan_tier) return;

  if (org?.stripe_subscription_id) {
    const stripe = createStripeClient();
    const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
    const tierItem = subscription.items.data.find((item) => priceIdToTier(item.price.id));
    if (tierItem) {
      await stripe.subscriptionItems.update(tierItem.id, { price: TIER_PRICE_IDS[tier] });
    }
  }

  await admin.from("organizations").update({ plan_tier: tier }).eq("id", organizationId);
}
