import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPaymentLink } from "@/lib/paymentLinks";
import { createSubscriptionCheckout } from "@/lib/subscriptionCheckout";

// Public: the payer has no account. The payment link's token is the only
// authorization, and all it authorizes is starting checkout for that one
// organization's plan. Taken in the body rather than the URL so it stays
// out of request logs.
export async function POST(request: Request) {
  let body: { token?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Falls through to the invalid-link response.
  }
  const token = typeof body.token === "string" ? body.token : "";

  const admin = createAdminClient();
  const found = await findPaymentLink(admin, token);
  if (!found.ok) {
    return NextResponse.json({ error: "This payment link is no longer valid." }, { status: 410 });
  }

  const origin = new URL(request.url).origin;
  const result = await createSubscriptionCheckout({
    admin,
    organizationId: found.link.organizationId,
    billingEmail: found.link.payerEmail,
    makeBillingContact: true,
    successUrl: `${origin}/pay/${token}?paid=1`,
    cancelUrl: `${origin}/pay/${token}`,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url });
}
