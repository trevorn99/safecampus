import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { BillingActions } from "./BillingActions";
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
  const { supabase, member, organizationName, isAdmin } = await requireMembership({
    allowUnpaid: true,
  });

  const [{ data: org }, { count: seatCount }] = await Promise.all([
    supabase
      .from("organizations")
      .select("subscription_status, trial_ends_at, stripe_customer_id, paywall_exempt")
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

  return (
    <>
      <AppHeader isAdmin={isAdmin} />
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
              Billed per active member — {seatCount ?? 0} seat{seatCount === 1 ? "" : "s"} today.
            </p>
          </div>

          {!isAdmin && needsSubscription && (
            <p className={styles.helperText}>
              Your organization needs an active subscription. Ask an org admin to subscribe.
            </p>
          )}

          {isAdmin && !org?.paywall_exempt && (
            <BillingActions hasStripeCustomer={Boolean(org?.stripe_customer_id)} />
          )}
        </div>
      </main>
    </>
  );
}
