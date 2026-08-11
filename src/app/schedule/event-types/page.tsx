import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { EventTypesManager } from "./EventTypesManager";
import styles from "@/styles/ui.module.css";

export default async function EventTypesPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/schedule");
  }

  const { data: eventTypes } = await supabase
    .from("event_types")
    .select("id, name")
    .eq("organization_id", member.organization_id)
    .order("name");

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Event types</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        <EventTypesManager organizationId={member.organization_id} eventTypes={eventTypes ?? []} />

        <Link href="/schedule" className={styles.link}>
          ← Back to schedule
        </Link>
      </main>
    </>
  );
}
