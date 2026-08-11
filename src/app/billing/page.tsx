import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { BillingActions } from "./BillingActions";
import { AddonToggle } from "./AddonToggle";
import { SEAT_CAPS, TIER_LABEL, tierForSeatCount, createStripeClient, type PlanTier } from "@/lib/stripe";
import styles from "@/styles/ui.module.css";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
};

// Pulled out of the component body: react-hooks/purity flags impure calls
// (Date.now()) made directly during render, even in an async server
// component that only ever runs per-request.
function isPastTrial(trialEndsAt: Date | null): boolean {
  return trialEndsAt ? trialEndsAt.getTime() < Date.now() : false;
}

export default async function BillingPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership({
    allowUnpaid: true,
  });

  const [{ data: org }, { count: seatCount }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "subscription_status, trial_ends_at, stripe_customer_id, paywall_exempt, plan_tier, threat_intel_enabled, identity_verification_enabled",
      )
      .eq("id", member.organization_id)
      .single(),
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", member.organization_id)
      .eq("status", "active"),
  ]);

  const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const trialExpired = isPastTrial(trialEndsAt);
  const needsSubscription =
    !org?.paywall_exempt &&
    org?.subscription_status !== "active" &&
    !(org?.subscription_status === "trialing" && !trialExpired);

  const currentTier = (org?.plan_tier as PlanTier | null) ?? tierForSeatCount(seatCount ?? 1);
  const overCap = !tierForSeatCount(seatCount ?? 1);
  const hasSubscription = org?.subscription_status === "active" || org?.subscription_status === "past_due";

  const invoices =
    isAdmin && org?.stripe_customer_id
      ? (await createStripeClient().invoices.list({ customer: org.stripe_customer_id, limit: 12 })).data
      : [];

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Billing</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              {org?.paywall_exempt ? "Comped by SafeCampus" : STATUS_LABEL[org?.subscription_status ?? ""] ?? "Unknown"}
            </h2>
            {org?.subscription_status === "trialing" && !org.paywall_exempt && trialEndsAt && (
              <p className={styles.itemMeta}>
                {trialExpired
                  ? "Your trial has ended."
                  : `Trial ends ${trialEndsAt.toLocaleDateString()}.`}
              </p>
            )}
            <p className={styles.itemMeta}>
              {seatCount ?? 0} active member{seatCount === 1 ? "" : "s"}
              {currentTier && !overCap ? ` of ${SEAT_CAPS[currentTier]} on ${TIER_LABEL[currentTier]}` : ""}.
            </p>
            {overCap && (
              <p className={styles.itemMeta}>
                You&apos;re over our largest self-serve plan (50 users) — contact us to set up a custom plan.
              </p>
            )}
          </div>

          {!isAdmin && needsSubscription && (
            <p className={styles.helperText}>
              Your organization needs an active subscription. Ask an org admin to subscribe.
            </p>
          )}

          {isAdmin && !org?.paywall_exempt && !overCap && (
            <BillingActions hasStripeCustomer={Boolean(org?.stripe_customer_id)} hasSubscription={hasSubscription} />
          )}
        </div>

        {isAdmin && !org?.paywall_exempt && (
          <AddonToggle
            addon="threat_intel"
            title="Threat Intelligence — $30/mo add-on"
            checkboxLabel="Enable Threat Intelligence for this organization"
            initialEnabled={Boolean(org?.threat_intel_enabled)}
            hasSubscription={hasSubscription}
            enabledMessage="Enabled — generate or review your combined report from the Threat Intelligence page."
            disabledMessage="Disabled for this organization."
            description={[
              "One AI-drafted intelligence brief covering your whole organization — every location combined — refreshed weekly and available on demand, drawing on incident history and watchlist activity, reviewed by your admins before release.",
              "Uses public web search, X/Twitter search, and government advisories (DHS, FBI/CISA). Certain platforms — including private Facebook groups, Instagram, and TikTok — can't be monitored through an API in an automated fashion, so this is always a starting point to combine with your team's own human intelligence, not a replacement for it.",
            ]}
          />
        )}

        {isAdmin && !org?.paywall_exempt && (
          <AddonToggle
            addon="identity_verification"
            title="Identity Verification — $10/mo add-on"
            checkboxLabel="Require identity verification for this organization"
            initialEnabled={Boolean(org?.identity_verification_enabled)}
            hasSubscription={hasSubscription}
            enabledMessage="Enabled — every non-admin member must verify their identity (photo ID + selfie, via Stripe) before they can use the app. Members not yet verified will be prompted the next time they sign in."
            disabledMessage="Disabled for this organization. Members are no longer required to verify."
            description={[
              "Requires every member to verify their identity with a government-issued photo ID and a live selfie, handled by Stripe Identity's hosted flow — SafeCampus never sees or stores the document itself.",
              "Org admins are exempt from the requirement so enabling this can never lock you out of your own organization.",
            ]}
          />
        )}

        {isAdmin && invoices.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Billing history</h2>
            </div>
            <ul className={styles.list}>
              {invoices.map((invoice) => (
                <li key={invoice.id} className={styles.listRow}>
                  <div>
                    <p className={styles.itemName}>
                      {invoice.created ? new Date(invoice.created * 1000).toLocaleDateString() : "—"}
                    </p>
                    <p className={styles.itemMeta}>
                      {((invoice.amount_paid ?? 0) / 100).toLocaleString(undefined, {
                        style: "currency",
                        currency: (invoice.currency ?? "usd").toUpperCase(),
                      })}
                      {" · "}
                      {invoice.status}
                    </p>
                  </div>
                  {invoice.invoice_pdf && (
                    <a
                      href={invoice.invoice_pdf}
                      target="_blank"
                      rel="noreferrer"
                      className={`${styles.button} ${styles.buttonSecondary}`}
                    >
                      Download
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
