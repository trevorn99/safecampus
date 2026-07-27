import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient, tierForSeatCount, TIER_PRICE_IDS } from "@/lib/stripe";

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
    const item = subscription.items.data[0];
    if (item) {
      await stripe.subscriptionItems.update(item.id, { price: TIER_PRICE_IDS[tier] });
    }
  }

  await admin.from("organizations").update({ plan_tier: tier }).eq("id", organizationId);
}
