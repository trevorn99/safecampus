import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStripeClient, tierForSeatCount, TIER_PRICE_IDS, type PlanTier } from "@/lib/stripe";
import { MIN_CARRIED_TRIAL_MS } from "@/lib/billing";

// Starting a subscription for an organization, shared by the two ways one
// can begin: an org admin pressing Subscribe, and someone outside the
// organization following a payment link (lib/paymentLinks.ts). One copy, so
// the rules — no second subscription, trial carried over, plan sized to the
// roster — can't differ depending on who is paying.

export type SubscriptionQuote = {
  orgName: string;
  tier: PlanTier;
  seatCount: number;
  /** When billing will start, if the remaining trial carries over. */
  trialCarriesUntil: Date | null;
};

export type QuoteResult =
  | { ok: true; quote: SubscriptionQuote }
  | { ok: false; status: number; error: string; reason: "subscribed" | "exempt" | "over_cap" | "missing" };

/**
 * Whether this organization can start a subscription right now, and on what
 * terms. Read with the service-role client: callers have already decided
 * the request is allowed (an org admin, or a valid payment link).
 */
export async function quoteSubscription(admin: SupabaseClient, organizationId: string): Promise<QuoteResult> {
  const [{ data: org }, { count: seatCount }] = await Promise.all([
    admin
      .from("organizations")
      .select("name, stripe_subscription_id, subscription_status, trial_ends_at, paywall_exempt")
      .eq("id", organizationId)
      .maybeSingle(),
    admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active"),
  ]);

  if (!org) return { ok: false, status: 404, error: "Organization not found.", reason: "missing" };

  if (org.paywall_exempt) {
    return { ok: false, status: 409, error: "This organization doesn't need a paid subscription.", reason: "exempt" };
  }

  // A second checkout would start a second subscription on the same
  // customer and bill twice. An org already subscribed — including one that
  // subscribed during its trial and hasn't been charged yet — manages its
  // plan through the billing portal instead.
  if (org.stripe_subscription_id && ["active", "past_due", "trialing"].includes(org.subscription_status ?? "")) {
    return {
      ok: false,
      status: 409,
      error: "This organization is already subscribed. Use Manage billing to change the plan.",
      reason: "subscribed",
    };
  }

  const tier = tierForSeatCount(seatCount ?? 1);
  if (!tier) {
    return {
      ok: false,
      status: 400,
      error: "This organization is larger than our self-serve plans support — contact us to set up a custom plan.",
      reason: "over_cap",
    };
  }

  // Subscribing during the free trial used to start billing on the spot and
  // throw the rest of the trial away. The remaining trial now carries over:
  // the card is saved now and first charged when the trial would have
  // ended. Stripe requires a Checkout trial to end at least 48 hours out,
  // so with less left than that billing starts today.
  const trialEndsAt = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const carries =
    org.subscription_status === "trialing" &&
    trialEndsAt !== null &&
    trialEndsAt.getTime() - Date.now() > MIN_CARRIED_TRIAL_MS;

  return {
    ok: true,
    quote: { orgName: org.name, tier, seatCount: seatCount ?? 1, trialCarriesUntil: carries ? trialEndsAt : null },
  };
}

export type CheckoutResult = { ok: true; url: string } | { ok: false; status: number; error: string };

export async function createSubscriptionCheckout({
  admin,
  organizationId,
  billingEmail,
  makeBillingContact,
  successUrl,
  cancelUrl,
}: {
  admin: SupabaseClient;
  organizationId: string;
  /** Where Stripe sends receipts, if a customer has to be created. */
  billingEmail: string | null;
  /**
   * Make billingEmail the receipt address even on an existing customer —
   * true for a payment link, whose whole point is that someone else pays.
   */
  makeBillingContact: boolean;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutResult> {
  const quoted = await quoteSubscription(admin, organizationId);
  if (!quoted.ok) return quoted;
  const { quote } = quoted;

  const { data: org } = await admin
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", organizationId)
    .single();

  const stripe = createStripeClient();
  let customerId = org?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: quote.orgName,
      ...(billingEmail ? { email: billingEmail } : {}),
      metadata: { organization_id: organizationId },
    });
    customerId = customer.id;
    await admin.from("organizations").update({ stripe_customer_id: customerId }).eq("id", organizationId);
  } else if (makeBillingContact && billingEmail) {
    await stripe.customers.update(customerId, { email: billingEmail });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: TIER_PRICE_IDS[quote.tier], quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: organizationId,
    subscription_data: {
      metadata: { organization_id: organizationId },
      ...(quote.trialCarriesUntil ? { trial_end: Math.floor(quote.trialCarriesUntil.getTime() / 1000) } : {}),
    },
  });

  if (!session.url) return { ok: false, status: 502, error: "Stripe didn't return a checkout page." };
  return { ok: true, url: session.url };
}
