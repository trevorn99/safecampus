import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Separate endpoint (and separate webhook secret) from /api/billing/webhook
// — identity events are registered against their own Stripe Dashboard
// destination, matching this app's one-route-per-concern pattern (see also
// /api/sms/webhook).
export async function POST(request: Request) {
  const stripe = createStripeClient();
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_IDENTITY_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (
    event.type === "identity.verification_session.verified" ||
    event.type === "identity.verification_session.requires_input"
  ) {
    const session = event.data.object as Stripe.Identity.VerificationSession;
    const memberId = session.metadata?.member_id;
    if (memberId) {
      const admin = createAdminClient();
      if (event.type === "identity.verification_session.verified") {
        await admin
          .from("members")
          .update({ identity_verification_status: "verified", identity_verification_error: null })
          .eq("id", memberId)
          .eq("stripe_identity_session_id", session.id);
      } else {
        await admin
          .from("members")
          .update({
            identity_verification_status: "failed",
            identity_verification_error: session.last_error?.reason ?? "Verification failed.",
          })
          .eq("id", memberId)
          .eq("stripe_identity_session_id", session.id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
