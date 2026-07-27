import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { NewSeriesForm } from "./NewSeriesForm";
import styles from "@/styles/ui.module.css";

export default async function NewSeriesPage() {
  const { supabase, member, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/schedule");
  }

  const [{ data: locations }, { data: templates }] = await Promise.all([
    supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
    supabase.from("event_templates").select("id, name").eq("organization_id", member.organization_id),
  ]);

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <NewSeriesForm
          organizationId={member.organization_id}
          locations={locations ?? []}
          templates={templates ?? []}
        />
      </main>
    </>
  );
}
