import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireMembership() {
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

  return {
    supabase,
    user,
    member,
    organizationName: organization?.name ?? "Your organization",
    isAdmin: Boolean(isAdmin),
  };
}
