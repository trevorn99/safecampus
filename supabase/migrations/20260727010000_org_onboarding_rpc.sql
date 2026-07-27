-- Org onboarding bootstrap.
--
-- Normal RLS deliberately has no INSERT policy on organizations, and members
-- can only be inserted by an existing org_admin (see brief §04/§06) — which
-- is exactly right for adding people to an org that already exists, but
-- can't be how the very first org and its first admin get created (there's
-- no admin yet to authorize it). This function is the one narrow, audited
-- escape hatch for that bootstrap step: security definer, but scoped so it
-- can only ever create a brand-new org and make the calling user its admin
-- — it has no ability to touch an org that already exists.

create or replace function public.create_organization_with_admin(
  p_org_name text,
  p_admin_name text,
  p_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception 'must be authenticated to create an organization';
  end if;

  if exists (select 1 from members where user_id = v_user_id) then
    raise exception 'this account already belongs to an organization';
  end if;

  insert into organizations (name, timezone)
    values (p_org_name, p_timezone)
    returning id into v_org_id;

  insert into members (organization_id, user_id, name, email, status)
    values (v_org_id, v_user_id, p_admin_name, (select email from auth.users where id = v_user_id), 'active')
    returning id into v_member_id;

  insert into role_assignments (member_id, scope_type, scope_id, role)
    values (v_member_id, 'org', v_org_id, 'org_admin');

  return v_org_id;
end;
$$;

revoke execute on function public.create_organization_with_admin(text, text, text) from public;
grant execute on function public.create_organization_with_admin(text, text, text) to authenticated;
