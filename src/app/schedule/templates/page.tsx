import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { NewTemplateForm } from "./NewTemplateForm";
import styles from "@/styles/ui.module.css";

export default async function TemplatesPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/schedule");
  }

  const [{ data: templates }, { data: eventTypes }] = await Promise.all([
    supabase
      .from("event_templates")
      .select("id, name, description, default_type")
      .eq("organization_id", member.organization_id)
      .order("name"),
    supabase.from("event_types").select("name").eq("organization_id", member.organization_id).order("name"),
  ]);

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Event templates</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        <div className={styles.card}>
          {(templates ?? []).length === 0 && <p className={styles.helperText}>No templates yet.</p>}
          <ul className={styles.list}>
            {(templates ?? []).map((template) => (
              <li key={template.id} className={styles.listRow}>
                <div>
                  <Link href={`/schedule/templates/${template.id}`} className={styles.itemName}>
                    {template.name}
                  </Link>
                  {template.description && <p className={styles.itemMeta}>{template.description}</p>}
                </div>
                {template.default_type && <span className={styles.pillMuted}>{template.default_type}</span>}
              </li>
            ))}
          </ul>
        </div>

        <NewTemplateForm organizationId={member.organization_id} eventTypes={(eventTypes ?? []).map((t) => t.name)} />

        <Link href="/schedule" className={styles.link}>
          ← Back to schedule
        </Link>
      </main>
    </>
  );
}
