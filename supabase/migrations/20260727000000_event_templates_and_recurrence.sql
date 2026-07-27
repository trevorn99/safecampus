-- Event templates, position slots, and recurring event series.
--
-- Positions are slots to be filled (e.g. "Main Entrance", 2 people needed),
-- distinct from assignments (a specific member filling one). A position's
-- time/location default to its event's, but are concrete editable fields on
-- event_positions, not a live reference — so overriding one never touches
-- the event or the template.
--
-- Recurrence is stored as an RFC 5545 RRULE string (the iCalendar standard —
-- e.g. `FREQ=MONTHLY;BYDAY=3SU` for "every 3rd Sunday"), not a bespoke
-- scheme. Actually generating occurrences (turning a series + RRULE into
-- concrete `events` rows) is application logic, not something this schema
-- does on its own — a scheduled job walks each active series forward and
-- creates events/positions from its template as needed.

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------

create table event_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_templates_org_idx on event_templates(organization_id);

create table template_positions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references event_templates(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  title text not null,
  location_id uuid references locations(id) on delete set null, -- null = use the event's location
  start_offset_minutes integer not null default 0,               -- minutes from event start; 0 = same as event start
  end_offset_minutes integer,                                     -- null = no defined end
  slots integer not null default 1 check (slots > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index template_positions_template_idx on template_positions(template_id);

-- ---------------------------------------------------------------------------
-- Recurring series
-- ---------------------------------------------------------------------------

create table event_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  template_id uuid references event_templates(id) on delete set null,
  title text not null,
  recurrence_rule text not null, -- RFC 5545 RRULE, e.g. FREQ=WEEKLY;BYDAY=SU
  first_occurrence_at timestamptz not null,
  duration_minutes integer not null default 60,
  active boolean not null default true, -- false stops generating future occurrences without deleting history
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_series_org_idx on event_series(organization_id);
create index event_series_location_idx on event_series(location_id);

alter table events
  add column series_id uuid references event_series(id) on delete set null,
  add column template_id uuid references event_templates(id) on delete set null;
create index events_series_idx on events(series_id);
create index events_template_idx on events(template_id);

-- ---------------------------------------------------------------------------
-- Positions (concrete, per-event) and their assignments
-- ---------------------------------------------------------------------------

create table event_positions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  title text not null,
  location_id uuid references locations(id) on delete set null, -- null = use the event's location
  start_time timestamptz not null,                                -- resolved concrete time; freely editable after creation
  end_time timestamptz,
  slots integer not null default 1 check (slots > 0),
  template_position_id uuid references template_positions(id) on delete set null, -- traceability only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_positions_event_idx on event_positions(event_id);
create index event_positions_template_position_idx on event_positions(template_position_id);

-- assignments now point at a position rather than an event directly; a
-- position carries its own team/time/location, which assignments no longer
-- need to duplicate. Safe as a hard schema change (drop + add, no backfill)
-- since nothing has been built against the old shape yet.
drop policy "read own org assignments" on assignments;
drop policy "member updates own assignment status" on assignments;
drop policy "admin manages assignments" on assignments;
drop policy "admin deletes assignments" on assignments;
drop index if exists assignments_event_idx;

alter table assignments
  drop column event_id,
  drop column team_id,
  drop column role,
  add column event_position_id uuid not null references event_positions(id) on delete cascade;
create index assignments_event_position_idx on assignments(event_position_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'event_templates', 'template_positions', 'event_series', 'event_positions'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table event_templates enable row level security;
alter table template_positions enable row level security;
alter table event_series enable row level security;
alter table event_positions enable row level security;

create policy "read own org event templates" on event_templates
  for select using (organization_id in (select current_org_ids()));
create policy "admin manages event templates" on event_templates
  for insert with check (is_org_admin(organization_id));
create policy "admin updates event templates" on event_templates
  for update using (is_org_admin(organization_id));
create policy "admin deletes event templates" on event_templates
  for delete using (is_org_admin(organization_id));

create policy "read own org template positions" on template_positions
  for select using (
    exists (select 1 from event_templates t where t.id = template_positions.template_id and t.organization_id in (select current_org_ids()))
  );
create policy "admin manages template positions" on template_positions
  for insert with check (
    exists (select 1 from event_templates t where t.id = template_positions.template_id and is_org_admin(t.organization_id))
  );
create policy "admin updates template positions" on template_positions
  for update using (
    exists (select 1 from event_templates t where t.id = template_positions.template_id and is_org_admin(t.organization_id))
  );
create policy "admin deletes template positions" on template_positions
  for delete using (
    exists (select 1 from event_templates t where t.id = template_positions.template_id and is_org_admin(t.organization_id))
  );

create policy "read own org event series" on event_series
  for select using (organization_id in (select current_org_ids()));
create policy "manage own org event series" on event_series
  for insert with check (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)));
create policy "update own org event series" on event_series
  for update using (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)));
create policy "delete own org event series" on event_series
  for delete using (is_org_admin(organization_id));

create policy "read own org event positions" on event_positions
  for select using (
    exists (select 1 from events e where e.id = event_positions.event_id and e.organization_id in (select current_org_ids()))
  );
create policy "manage own org event positions" on event_positions
  for insert with check (
    exists (select 1 from events e where e.id = event_positions.event_id and (is_org_admin(e.organization_id) or (e.location_id is not null and is_location_manager(e.location_id))))
  );
create policy "update own org event positions" on event_positions
  for update using (
    exists (select 1 from events e where e.id = event_positions.event_id and (is_org_admin(e.organization_id) or (e.location_id is not null and is_location_manager(e.location_id))))
  );
create policy "delete own org event positions" on event_positions
  for delete using (
    exists (select 1 from events e where e.id = event_positions.event_id and is_org_admin(e.organization_id))
  );

create policy "read own org assignments" on assignments
  for select using (
    exists (
      select 1 from event_positions p
      join events e on e.id = p.event_id
      where p.id = assignments.event_position_id and e.organization_id in (select current_org_ids())
    )
  );
create policy "member updates own assignment status" on assignments
  for update using (
    exists (select 1 from members m where m.id = assignments.member_id and m.user_id = auth.uid())
    or exists (
      select 1 from event_positions p join events e on e.id = p.event_id
      where p.id = assignments.event_position_id and is_org_admin(e.organization_id)
    )
  );
create policy "admin manages assignments" on assignments
  for insert with check (
    exists (
      select 1 from event_positions p join events e on e.id = p.event_id
      where p.id = assignments.event_position_id and is_org_admin(e.organization_id)
    )
  );
create policy "admin deletes assignments" on assignments
  for delete using (
    exists (
      select 1 from event_positions p join events e on e.id = p.event_id
      where p.id = assignments.event_position_id and is_org_admin(e.organization_id)
    )
  );
