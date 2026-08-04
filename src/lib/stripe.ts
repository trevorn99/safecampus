import "server-only";
import Stripe from "stripe";

export function createStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// Three flat-rate plans, each a separate flat (non-per-seat) Price created
// once in the Stripe dashboard. Orgs auto-upgrade between them as their
// active member count crosses a cap — see tierForSeatCount() below.
export const TIER_PRICE_IDS = {
  tier_10: process.env.STRIPE_TIER_10_PRICE_ID!,
  tier_30: process.env.STRIPE_TIER_30_PRICE_ID!,
  tier_50: process.env.STRIPE_TIER_50_PRICE_ID!,
} as const;

export type PlanTier = keyof typeof TIER_PRICE_IDS;

// Threat Intelligence add-on: $30/mo, added as a second item on an org's
// existing subscription rather than a separate plan or Checkout session.
export const THREAT_INTEL_PRICE_ID = process.env.STRIPE_THREAT_INTEL_PRICE_ID!;

// Identity Verification add-on: $10/mo, same pattern — a second item on the
// org's existing subscription. The actual verification work happens
// through the separate Stripe Identity API (src/app/api/identity/*), not
// this billing price; this just gates whether the org has paid for it.
export const IDENTITY_VERIFICATION_PRICE_ID = process.env.STRIPE_IDENTITY_VERIFICATION_PRICE_ID!;

export const ADDONS = {
  threat_intel: { priceId: THREAT_INTEL_PRICE_ID, column: "threat_intel_enabled" },
  identity_verification: { priceId: IDENTITY_VERIFICATION_PRICE_ID, column: "identity_verification_enabled" },
} as const;

export type AddonKey = keyof typeof ADDONS;

export const SEAT_CAPS: Record<PlanTier, number> = {
  tier_10: 10,
  tier_30: 30,
  tier_50: 50,
};

export const TIER_LABEL: Record<PlanTier, string> = {
  tier_10: "Up to 10 users",
  tier_30: "Up to 30 users",
  tier_50: "Up to 50 users",
};

// null means the org is over the top self-serve tier (50 seats) — there's no
// Price for that yet, so it needs a manually arranged plan.
export function tierForSeatCount(count: number): PlanTier | null {
  if (count <= SEAT_CAPS.tier_10) return "tier_10";
  if (count <= SEAT_CAPS.tier_30) return "tier_30";
  if (count <= SEAT_CAPS.tier_50) return "tier_50";
  return null;
}

export function priceIdToTier(priceId: string | undefined): PlanTier | null {
  const entry = (Object.entries(TIER_PRICE_IDS) as [PlanTier, string][]).find(
    ([, id]) => id === priceId,
  );
  return entry ? entry[0] : null;
}
