import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/AppHeader";
import { ExemptionToggle } from "./ExemptionToggle";
import { TIER_LABEL, type PlanTier } from "@/lib/stripe";
import styles from "@/styles/ui.module.css";

export default async function PlatformAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (!isPlatformAdmin) {
    redirect("/dashboard");
  }

  // platform_admins/organizations-with-billing-fields aren't reachable
  // through a regular org member's RLS, so this page reads via the
  // service-role client — same pattern the future Support Console uses.
  const admin = createAdminClient();
  const { data: organizations } = await admin
    .from("organizations")
    .select("id, name, subscription_status, trial_ends_at, paywall_exempt, plan_tier")
    .order("name");

  return (
    <>
      <AppHeader isAdmin={false} isPlatformAdmin />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Platform admin</h1>
          <p className={styles.subtitle}>Paywall exemptions</p>
        </div>

        <div className={styles.card}>
          <ul className={styles.list}>
            {(organizations ?? []).map((org) => (
              <li key={org.id} className={styles.listRow}>
                <div>
                  <p className={styles.itemName}>{org.name}</p>
                  <p className={styles.itemMeta}>
                    {org.subscription_status}
                    {org.plan_tier ? ` · ${TIER_LABEL[org.plan_tier as PlanTier]}` : ""}
                    {org.subscription_status === "trialing" && org.trial_ends_at
                      ? ` · trial ends ${new Date(org.trial_ends_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <ExemptionToggle organizationId={org.id} exempt={org.paywall_exempt} />
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
