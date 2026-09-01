import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { OrgNameForm } from "./OrgNameForm";
import { OrgSmsToggle } from "./OrgSmsToggle";
import styles from "@/styles/ui.module.css";

export default async function OrganizationSettingsPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const { data: org } = await supabase
    .from("organizations")
    .select("name, sms_enabled")
    .eq("id", member.organization_id)
    .single();

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Organization settings</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        {isAdmin ? (
          <>
            <OrgNameForm initialName={org?.name ?? ""} />
            <OrgSmsToggle initialEnabled={Boolean(org?.sms_enabled)} />
          </>
        ) : (
          <p className={styles.helperText}>Organization settings are visible to org admins only.</p>
        )}
      </main>
    </>
  );
}
