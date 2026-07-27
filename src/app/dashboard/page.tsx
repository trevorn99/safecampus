import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { centeredStyle } from "@/lib/ui";

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
    <main style={centeredStyle}>
      <h1>{orgName}</h1>
      <p>Welcome, {member.name}.</p>
      {isAdmin && <a href="/team/invite">Invite a team member</a>}
      <form action="/auth/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
