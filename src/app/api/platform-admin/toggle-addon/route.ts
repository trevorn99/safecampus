import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADDONS, type AddonKey } from "@/lib/stripe";

// Grants (or removes) an add-on for an organization from the platform-admin
// console, without Stripe. The point is comped organizations: paywall_exempt
// gets them past has_active_access(), but add-ons are a separate column that
// only /billing could set — and only an admin *of that org*, which a platform
// admin comping someone else's organization isn't.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (!isPlatformAdmin) {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { organizationId, addon, enabled } = (await request.json()) as {
    organizationId: string;
    addon: AddonKey;
    enabled: boolean;
  };
  const addonConfig = ADDONS[addon];
  if (!organizationId || !addonConfig) {
    return NextResponse.json({ error: "Unknown organization or add-on" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("stripe_subscription_id")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Refused for subscribed orgs on purpose. syncSubscriptionFromStripe()
  // recomputes both add-on columns from the subscription's line items on
  // every webhook, so a grant made here would vanish the next time any
  // subscription event fired — a setting that silently reverts is worse than
  // one that was never offered. Those orgs change add-ons on their own
  // billing page, where Stripe is updated too.
  if (org.stripe_subscription_id) {
    return NextResponse.json(
      {
        error:
          "This organization bills add-ons through Stripe — a change here would be overwritten by the next subscription sync. Change it from the organization's own billing page.",
      },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from("organizations")
    .update({ [addonConfig.column]: Boolean(enabled) })
    .eq("id", organizationId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
