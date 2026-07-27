import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { AddTemplatePositionForm } from "./AddTemplatePositionForm";
import { DeleteTemplatePositionButton } from "./DeleteTemplatePositionButton";
import { DeleteTemplateButton } from "./DeleteTemplateButton";
import styles from "@/styles/ui.module.css";

function formatOffset(minutes: number) {
  if (minutes === 0) return "at event start";
  const sign = minutes > 0 ? "+" : "-";
  return `${sign}${Math.abs(minutes)} min`;
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/schedule");
  }

  const [{ data: template }, { data: teams }, { data: positions }] = await Promise.all([
    supabase.from("event_templates").select("id, name, description").eq("id", templateId).maybeSingle(),
    supabase.from("teams").select("id, name").eq("organization_id", member.organization_id),
    supabase
      .from("template_positions")
      .select("id, title, team_id, start_offset_minutes, end_offset_minutes, slots")
      .eq("template_id", templateId)
      .order("start_offset_minutes"),
  ]);

  if (!template) {
    return (
      <>
        <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
        <main className={styles.appMain}>
          <p className={styles.helperText}>Template not found.</p>
          <Link href="/schedule/templates" className={styles.link}>
            ← Back to templates
          </Link>
        </main>
      </>
    );
  }

  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>{template.name}</h1>
          <p className={styles.subtitle}>{organizationName}{template.description ? ` · ${template.description}` : ""}</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Positions</h2>
          </div>
          {(positions ?? []).length === 0 && <p className={styles.helperText}>No positions yet.</p>}
          <ul className={styles.list}>
            {(positions ?? []).map((position) => (
              <li key={position.id} className={styles.listRow}>
                <div>
                  <p className={styles.itemName}>{position.title}</p>
                  <p className={styles.itemMeta}>
                    {formatOffset(position.start_offset_minutes)}
                    {position.end_offset_minutes != null ? ` – ${formatOffset(position.end_offset_minutes)}` : ""}
                    {position.team_id ? ` · ${teamName.get(position.team_id) ?? "Unknown team"}` : ""}
                    {` · ${position.slots} needed`}
                  </p>
                </div>
                <DeleteTemplatePositionButton positionId={position.id} />
              </li>
            ))}
          </ul>
          <AddTemplatePositionForm templateId={template.id} teams={teams ?? []} />
        </div>

        <DeleteTemplateButton templateId={template.id} name={template.name} />

        <Link href="/schedule/templates" className={styles.link}>
          ← Back to templates
        </Link>
      </main>
    </>
  );
}
