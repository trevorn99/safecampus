import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/AppHeader";
import { ExemptionToggle } from "./ExemptionToggle";
import { SupportAccessControls } from "./SupportAccessControls";
import { TIER_LABEL, type PlanTier } from "@/lib/stripe";
import styles from "@/styles/ui.module.css";

// Pulled out of the component body — react-hooks/purity flags impure calls
// (Date construction with no args) made directly during render.
function currentIso(): string {
  return new Date().toISOString();
}

type GrantRow = {
  id: string;
  organization_id: string;
  platform_admin_id: string;
  reason: string;
  expires_at: string;
  platform_admins: { name: string } | { name: string }[] | null;
};

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
  // service-role client — same pattern the Support Console below uses.
  const admin = createAdminClient();
  const [{ data: organizations }, { data: grants }] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, subscription_status, trial_ends_at, paywall_exempt, plan_tier")
      .order("name"),
    admin
      .from("support_access_grants")
      .select("id, organization_id, platform_admin_id, reason, expires_at, platform_admins(name)")
      .is("revoked_at", null)
      .gt("expires_at", currentIso())
      .returns<GrantRow[]>(),
  ]);

  // At most one active grant surfaced per org — if two admins are both
  // troubleshooting the same org concurrently, this shows whichever grant
  // sorts first, which is a fine simplification for a small admin team.
  const activeGrantByOrg = new Map(
    (grants ?? []).map((grant) => {
      const adminRecord = Array.isArray(grant.platform_admins)
        ? grant.platform_admins[0]
        : grant.platform_admins;
      return [
        grant.organization_id,
        {
          id: grant.id,
          platformAdminId: grant.platform_admin_id,
          adminName: adminRecord?.name ?? "Unknown admin",
          reason: grant.reason,
          expiresAt: grant.expires_at,
        },
      ] as const;
    }),
  );

  return (
    <>
      <AppHeader isAdmin={false} isPlatformAdmin />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Platform admin</h1>
          <p className={styles.subtitle}>Every organization on SafeCampus</p>
        </div>

        <div className={styles.actions}>
          <Link href="/platform-admin/support-tickets" className={`${styles.button} ${styles.buttonSecondary}`}>
            View support tickets
          </Link>
        </div>

        <div className={styles.card}>
          <ul className={styles.list}>
            {(organizations ?? []).map((org) => {
              const activeGrant = activeGrantByOrg.get(org.id) ?? null;
              return (
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
                    {activeGrant && (
                      <p className={styles.itemMeta}>Reason: {activeGrant.reason}</p>
                    )}
                  </div>
                  <div className={styles.tagRow}>
                    <div className={styles.controlGroup}>
                      <span className={styles.controlLabel}>Billing</span>
                      <ExemptionToggle organizationId={org.id} exempt={org.paywall_exempt} />
                    </div>
                    <div className={styles.controlGroup}>
                      <span className={styles.controlLabel}>Support access</span>
                      <SupportAccessControls
                        organizationId={org.id}
                        currentUserId={user.id}
                        activeGrant={activeGrant}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
