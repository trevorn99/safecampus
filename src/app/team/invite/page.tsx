import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { InviteForm } from "./InviteForm";
import styles from "@/styles/ui.module.css";

export default async function InviteTeamMemberPage() {
  const { supabase, member, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/team");
  }

  const [{ data: locations }, { data: teams }] = await Promise.all([
    supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
    supabase.from("teams").select("id, name").eq("organization_id", member.organization_id),
  ]);

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <InviteForm
          organizationId={member.organization_id}
          locations={locations ?? []}
          teams={teams ?? []}
        />
      </main>
    </>
  );
}
