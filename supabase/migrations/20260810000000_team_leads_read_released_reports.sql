-- Team leads can see a threat report once it's released, but not while it's
-- still draft/reviewed — that stays org-admin-only. This is additive to the
-- existing "org admin reads threat reports" policy (permissive policies OR
-- together), so org admins keep full access at every status.

create or replace function public.is_team_lead(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from role_assignments ra
    join members m on m.id = ra.member_id
    join teams t on t.id = ra.scope_id
    where m.user_id = auth.uid()
      and ra.scope_type = 'team'
      and ra.role = 'team_lead'
      and t.organization_id = target_org
  );
$$;

create policy "team leads read released threat reports" on threat_reports
  for select using (
    status = 'released' and is_team_lead(organization_id)
  );
