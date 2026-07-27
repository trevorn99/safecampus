import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe";

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

async function syncSubscription(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata.organization_id;
  if (!organizationId) return;

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: STATUS_MAP[subscription.status] ?? "incomplete",
    })
    .eq("id", organizationId);
}

export async function POST(request: Request) {
  const stripe = createStripeClient();
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await syncSubscription(subscription);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
