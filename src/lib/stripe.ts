import "server-only";
import Stripe from "stripe";

export function createStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// The Price object (Product configured for per-unit, recurring billing) that
// backs the one plan SafeCampus offers today — quantity tracks active member
// count. Created once in the Stripe dashboard.
export const STRIPE_SEAT_PRICE_ID = process.env.STRIPE_SEAT_PRICE_ID!;
