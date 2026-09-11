-- Standing assignments: who normally fills a recurring position.
--
-- Assignments live on event_positions, which only exist once an occurrence
-- has been generated — so assigning someone "across the series" could only
-- ever reach the events that happened to exist at that moment. As the
-- rolling horizon advances, every newly generated occurrence came out
-- unfilled and somebody had to re-assign the same people to the same
-- position, indefinitely.
--
-- This table is the durable answer: the roster for the recurring position
-- itself. Generation copies it onto each new occurrence, so an assignment
-- persists until an admin changes it here rather than decaying every time
-- the horizon moves.
--
-- Removing someone from one occurrence still only affects that occurrence —
-- covering a single week is a normal thing to do and shouldn't rewrite the
-- standing roster.
create table template_position_assignments (
  id uuid primary key default gen_random_uuid(),
  template_position_id uuid not null references template_positions(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (template_position_id, member_id)
);

create index template_position_assignments_position_idx
  on template_position_assignments(template_position_id);

-- Team-scoped, unlike is_team_lead(org) from the released-reports migration,
-- which answers the broader "are you a lead of anything in this org". A team
-- lead should be able to set the standing roster for their own team's
-- positions and nobody else's.
create or replace function public.is_lead_of_team(target_team uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from role_assignments ra
    join members m on m.id = ra.member_id
    where m.user_id = auth.uid()
      and ra.scope_type = 'team'
      and ra.role = 'team_lead'
      and ra.scope_id = target_team
  );
$$;

alter table template_position_assignments enable row level security;

-- Visible to the whole org, like the roster and the schedule: knowing who
-- normally covers a position is the point of a published schedule.
create policy "read own org standing assignments" on template_position_assignments
  for select using (
    exists (
      select 1 from template_positions tp
      join event_templates t on t.id = tp.template_id
      where tp.id = template_position_assignments.template_position_id
        and t.organization_id in (select current_org_ids())
    )
  );

-- Written by an org admin, or by the lead of the team the position belongs
-- to. A position with no team_id is org-wide, so only an org admin sets it.
create policy "admin or team lead manages standing assignments" on template_position_assignments
  for insert with check (
    exists (
      select 1 from template_positions tp
      join event_templates t on t.id = tp.template_id
      where tp.id = template_position_assignments.template_position_id
        and (is_org_admin(t.organization_id) or (tp.team_id is not null and is_lead_of_team(tp.team_id)))
    )
  );
create policy "admin or team lead removes standing assignments" on template_position_assignments
  for delete using (
    exists (
      select 1 from template_positions tp
      join event_templates t on t.id = tp.template_id
      where tp.id = template_position_assignments.template_position_id
        and (is_org_admin(t.organization_id) or (tp.team_id is not null and is_lead_of_team(tp.team_id)))
    )
  );
