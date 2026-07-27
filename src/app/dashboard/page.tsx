import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "@/styles/ui.module.css";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, name, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    redirect("/onboarding");
  }

  const [{ data: isAdmin }, { data: organization }] = await Promise.all([
    supabase.rpc("is_org_admin", { target_org: member.organization_id }),
    supabase.from("organizations").select("name").eq("id", member.organization_id).single(),
  ]);

  const orgName = organization?.name ?? "Your organization";

  return (
    <>
      <header className={styles.appHeader}>
        <div className={styles.appHeaderInner}>
          <p className={styles.wordmark}>
            Safe<span className={styles.wordmarkAccent}>Campus</span>
          </p>
          <span className={styles.appHeaderMeta}>{member.name}</span>
        </div>
      </header>
      <main className={styles.appMain}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            {isAdmin && <span className={styles.badge}>Org admin</span>}
            <h1 className={styles.cardTitle}>{orgName}</h1>
            <p className={styles.subtitle}>Welcome, {member.name}.</p>
          </div>
          {isAdmin && (
            <a href="/team/invite" className={`${styles.button} ${styles.buttonPrimary}`}>
              Invite a team member
            </a>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" className={`${styles.button} ${styles.buttonSecondary}`}>
              Sign out
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
