import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe";

// Starts (or restarts, after a failed attempt) a Stripe-hosted identity
// verification flow for the calling member. The session id gets saved so
// the webhook can find the right member row when Stripe reports a result —
// see /api/identity/webhook. Actually setting status to "verified" or
// "failed" only ever happens there, never here (see the protective trigger
// on members in the identity_verification migration).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, organization_id, identity_verification_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("identity_verification_enabled")
    .eq("id", member.organization_id)
    .single();
  if (!org?.identity_verification_enabled) {
    return NextResponse.json({ error: "Identity verification isn't enabled for this organization" }, { status: 400 });
  }

  if (member.identity_verification_status === "verified") {
    return NextResponse.json({ error: "Already verified" }, { status: 400 });
  }

  const headersList = await headers();
  const returnUrl = `https://${headersList.get("host")}/account/identity`;

  const stripe = createStripeClient();
  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    return_url: returnUrl,
    options: { document: { require_matching_selfie: true } },
    metadata: { member_id: member.id, organization_id: member.organization_id },
  });

  const admin = createAdminClient();
  await admin
    .from("members")
    .update({
      stripe_identity_session_id: session.id,
      identity_verification_status: "pending",
      identity_verification_error: null,
    })
    .eq("id", member.id);

  return NextResponse.json({ url: session.url });
}
