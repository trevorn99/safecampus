import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OrgAdmin = { userId: string; memberId: string; name: string; email: string | null; organizationId: string };

/**
 * The signed-in org admin behind a billing request, or the HTTP error to
 * answer with. The billing routes all needed the same three checks.
 */
export async function requireOrgAdmin(): Promise<{ ok: true; admin: OrgAdmin } | { ok: false; status: number; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Not authenticated" };

  const { data: member } = await supabase
    .from("members")
    .select("id, name, email, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { ok: false, status: 403, error: "No organization" };

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: member.organization_id });
  if (!isAdmin) return { ok: false, status: 403, error: "Org admin required" };

  return {
    ok: true,
    admin: {
      userId: user.id,
      memberId: member.id,
      name: member.name,
      email: member.email ?? user.email ?? null,
      organizationId: member.organization_id,
    },
  };
}
