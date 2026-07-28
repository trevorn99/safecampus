import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { NewLocationForm } from "./NewLocationForm";
import { LocationRow } from "./LocationRow";
import styles from "@/styles/ui.module.css";

export default async function LocationsPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, address, timezone")
    .eq("organization_id", member.organization_id)
    .order("name");

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Locations</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        <div className={styles.card}>
          {(locations ?? []).length === 0 && <p className={styles.helperText}>No locations yet.</p>}
          <ul className={styles.list}>
            {(locations ?? []).map((location) => (
              <LocationRow key={location.id} location={location} isAdmin={isAdmin} />
            ))}
          </ul>
        </div>

        {isAdmin && <NewLocationForm organizationId={member.organization_id} />}
      </main>
    </>
  );
}
