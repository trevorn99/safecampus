import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { NewEventForm } from "./NewEventForm";
import styles from "@/styles/ui.module.css";

export default async function NewEventPage() {
  const { supabase, member, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/schedule");
  }

  const [{ data: locations }, { data: teams }, { data: templates }] = await Promise.all([
    supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
    supabase.from("teams").select("id, name").eq("organization_id", member.organization_id),
    supabase.from("event_templates").select("id, name").eq("organization_id", member.organization_id),
  ]);

  const templateIds = (templates ?? []).map((t) => t.id);
  const { data: templatePositions } =
    templateIds.length > 0
      ? await supabase
          .from("template_positions")
          .select("id, template_id, team_id, title, location_id, start_offset_minutes, end_offset_minutes, slots")
          .in("template_id", templateIds)
      : { data: [] };

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <NewEventForm
          organizationId={member.organization_id}
          locations={locations ?? []}
          teams={teams ?? []}
          templates={templates ?? []}
          templatePositions={templatePositions ?? []}
        />
      </main>
    </>
  );
}
