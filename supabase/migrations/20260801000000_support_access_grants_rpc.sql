-- Wires up support_access_grants (defined in the init migration, unused
-- until now): platform admins self-grant time-boxed, reason-logged access
-- to troubleshoot an org, rather than ever getting standing elevated RLS.
-- Writes to the grants table itself still only ever go through the
-- service-role client (see the API routes) — this function just lets the
-- gate check on the org-detail page run under the caller's own session,
-- same pattern as is_org_admin()/is_platform_admin().

create or replace function public.has_active_support_grant(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from support_access_grants
    where organization_id = target_org
      and platform_admin_id = auth.uid()
      and revoked_at is null
      and expires_at > now()
  );
$$;
