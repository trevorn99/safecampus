-- Per-org customizable event types, replacing the fixed
-- service/drill/meeting/training enum. Free text, same "free text by
-- design" precedent teams.type already set — there is deliberately no FK
-- from events.type/event_series.type to this table, so renaming or
-- deleting a type never breaks an existing event; it just keeps whatever
-- string it was created with (see the display fallback in eventTypes.ts).
create table event_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index event_types_org_idx on event_types(organization_id);

alter table event_types enable row level security;

create policy "read own org event types" on event_types
  for select using (organization_id in (select current_org_ids()));
create policy "admin manages event types" on event_types
  for insert with check (is_org_admin(organization_id));
create policy "admin updates event types" on event_types
  for update using (is_org_admin(organization_id));
create policy "admin deletes event types" on event_types
  for delete using (is_org_admin(organization_id));

-- The type is now open-ended per org, validated only at the UI layer via
-- event_types.
alter table events drop constraint events_type_check;
alter table event_series drop constraint event_series_type_check;

-- Backfill: every existing org gets the same four defaults events already
-- use today, so its type dropdown doesn't come up empty.
insert into event_types (organization_id, name)
select id, unnest(array['Service', 'Drill', 'Meeting', 'Training'])
from organizations
on conflict (organization_id, name) do nothing;

-- New orgs get the same defaults at creation time from now on.
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

  insert into event_types (organization_id, name)
    values (v_org_id, 'Service'), (v_org_id, 'Drill'), (v_org_id, 'Meeting'), (v_org_id, 'Training');

  return v_org_id;
end;
$$;
