import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient, tierForSeatCount, TIER_PRICE_IDS } from "@/lib/stripe";

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
    .select("id, organization_id, email")
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

  const { data: org } = await supabase
    .from("organizations")
    .select("name, stripe_customer_id")
    .eq("id", member.organization_id)
    .single();

  const { count: seatCount } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", member.organization_id)
    .eq("status", "active");

  const tier = tierForSeatCount(seatCount ?? 1);
  if (!tier) {
    return NextResponse.json(
      { error: "Your organization is larger than our self-serve plans support — contact us to set up a custom plan." },
      { status: 400 },
    );
  }

  const stripe = createStripeClient();
  const admin = createAdminClient();

  let customerId = org?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org?.name,
      email: member.email ?? user.email,
      metadata: { organization_id: member.organization_id },
    });
    customerId = customer.id;
    await admin
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", member.organization_id);
  }

  const origin = new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: TIER_PRICE_IDS[tier], quantity: 1 }],
    success_url: `${origin}/billing?checkout=success`,
    cancel_url: `${origin}/billing?checkout=cancelled`,
    client_reference_id: member.organization_id,
    subscription_data: { metadata: { organization_id: member.organization_id } },
  });

  return NextResponse.json({ url: session.url });
}
