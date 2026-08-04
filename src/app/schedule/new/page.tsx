import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { NewEventForm } from "./NewEventForm";
import styles from "@/styles/ui.module.css";

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ fromPco?: string }>;
}) {
  const { fromPco } = await searchParams;
  const { supabase, member, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/schedule");
  }

  const [{ data: locations }, { data: teams }, { data: templates }, { data: eventTypes }] = await Promise.all([
    supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
    supabase.from("teams").select("id, name").eq("organization_id", member.organization_id),
    supabase.from("event_templates").select("id, name").eq("organization_id", member.organization_id),
    supabase.from("event_types").select("name").eq("organization_id", member.organization_id).order("name"),
  ]);

  const templateIds = (templates ?? []).map((t) => t.id);
  const { data: templatePositions } =
    templateIds.length > 0
      ? await supabase
          .from("template_positions")
          .select("id, template_id, team_id, title, location_id, start_offset_minutes, end_offset_minutes, slots")
          .in("template_id", templateIds)
      : { data: [] };

  let pcoCandidate: { id: string; title: string; startTime: string; endTime: string } | null = null;
  if (fromPco) {
    const { data: candidate } = await supabase
      .from("pco_imported_events")
      .select("id, title, starts_at, ends_at")
      .eq("id", fromPco)
      .eq("organization_id", member.organization_id)
      .maybeSingle();
    if (candidate) {
      pcoCandidate = {
        id: candidate.id,
        title: candidate.title,
        startTime: toLocalInputValue(candidate.starts_at),
        endTime: toLocalInputValue(candidate.ends_at),
      };
    }
  }

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <NewEventForm
          organizationId={member.organization_id}
          eventTypes={(eventTypes ?? []).map((t) => t.name)}
          locations={locations ?? []}
          teams={teams ?? []}
          templates={templates ?? []}
          templatePositions={templatePositions ?? []}
          pcoCandidate={pcoCandidate}
        />
      </main>
    </>
  );
}
