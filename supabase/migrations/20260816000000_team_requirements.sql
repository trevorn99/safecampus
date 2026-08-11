-- Lets a team declare which certifications or trainings its members are
-- expected to hold. Free text, matching the certifications.type precedent
-- (no catalog table for either) — "name" is matched case-insensitively
-- against a member's certifications.type when checking compliance.
create table team_requirements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  kind text not null check (kind in ('certification', 'training')),
  name text not null,
  created_at timestamptz not null default now(),
  unique (team_id, kind, name)
);
create index team_requirements_team_idx on team_requirements(team_id);

alter table team_requirements enable row level security;

-- Same permission shape as teams itself: org admin everywhere, or the
-- location_manager of the team's own location.
create policy "read own org team requirements" on team_requirements
  for select using (
    exists (
      select 1 from teams t
      where t.id = team_requirements.team_id and t.organization_id in (select current_org_ids())
    )
  );
create policy "manage own org team requirements" on team_requirements
  for insert with check (
    exists (
      select 1 from teams t
      where t.id = team_requirements.team_id
        and (is_org_admin(t.organization_id) or (t.location_id is not null and is_location_manager(t.location_id)))
    )
  );
create policy "delete own org team requirements" on team_requirements
  for delete using (
    exists (
      select 1 from teams t
      where t.id = team_requirements.team_id
        and (is_org_admin(t.organization_id) or (t.location_id is not null and is_location_manager(t.location_id)))
    )
  );
