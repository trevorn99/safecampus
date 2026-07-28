import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { NewTeamForm } from "./NewTeamForm";
import styles from "@/styles/ui.module.css";

export default async function TeamsPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const [{ data: teams }, { data: locations }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, type, location_id")
      .eq("organization_id", member.organization_id)
      .order("name"),
    supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
  ]);

  const locationNames = new Map((locations ?? []).map((location) => [location.id, location.name]));

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Teams</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        <div className={styles.card}>
          {(teams ?? []).length === 0 && <p className={styles.helperText}>No teams yet.</p>}
          <ul className={styles.list}>
            {(teams ?? []).map((team) => (
              <li key={team.id} className={styles.listRow}>
                <div>
                  <Link href={`/teams/${team.id}`} className={styles.itemName}>
                    {team.name}
                  </Link>
                  <p className={styles.itemMeta}>{team.type}</p>
                </div>
                <span className={styles.pillMuted}>
                  {team.location_id ? locationNames.get(team.location_id) ?? "Unknown location" : "Org-wide"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {isAdmin && <NewTeamForm organizationId={member.organization_id} locations={locations ?? []} />}
      </main>
    </>
  );
}
