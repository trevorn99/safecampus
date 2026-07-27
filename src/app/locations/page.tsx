import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { NewLocationForm } from "./NewLocationForm";
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
              <li key={location.id} className={styles.listRow}>
                <div>
                  <p className={styles.itemName}>{location.name}</p>
                  {location.address && <p className={styles.itemMeta}>{location.address}</p>}
                </div>
                <div className={styles.tagRow}>
                  {location.timezone && <span className={styles.pillMuted}>{location.timezone}</span>}
                  <a href={`/locations/${location.id}/map`} className={styles.link}>
                    Map
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {isAdmin && <NewLocationForm organizationId={member.organization_id} />}
      </main>
    </>
  );
}
