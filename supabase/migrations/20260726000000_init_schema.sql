-- SafeCampus initial schema
-- Mirrors the data model in the architecture brief: organizations > locations >
-- teams > members, scoped role assignments, scheduling/training, and a
-- separately hardened set of sensitive tables (watchlist, background checks,
-- incident reports, audit log). See the brief for the "why" behind each
-- design choice referenced in comments below.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so they can read role_assignments /
-- members without triggering RLS recursion on those same tables)
-- ---------------------------------------------------------------------------

create or replace function public.current_org_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select organization_id from members where user_id = auth.uid();
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from role_assignments ra
    join members m on m.id = ra.member_id
    where m.user_id = auth.uid()
      and ra.scope_type = 'org'
      and ra.scope_id = target_org
      and ra.role = 'org_admin'
  );
$$;

-- True for a location_manager scoped to this exact location, or an org_admin
-- of the org that location belongs to (org_admin implies every location).
create or replace function public.is_location_manager(target_location uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from role_assignments ra
    join members m on m.id = ra.member_id
    where m.user_id = auth.uid()
      and (
        (ra.scope_type = 'location' and ra.scope_id = target_location and ra.role = 'location_manager')
        or (ra.scope_type = 'org' and ra.role = 'org_admin'
            and ra.scope_id = (select organization_id from locations where id = target_location))
      )
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Every write to a sensitive table lands here, including which platform_admin
-- (if any) made it. This function's owner is the migration role, which owns
-- every table below and therefore bypasses their RLS policies by default —
-- that's what lets this insert succeed regardless of the caller's own access.
create or replace function public.record_audit_log()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  org uuid;
  actor_kind text;
begin
  org := (to_jsonb(coalesce(new, old))->>'organization_id')::uuid;
  actor_kind := case when exists (select 1 from platform_admins where id = auth.uid())
                      then 'platform_admin' else 'org_member' end;

  insert into audit_logs (actor_id, actor_type, organization_id, action, table_name, record_id, occurred_at)
  values (auth.uid(), actor_kind, org, tg_op, tg_table_name, coalesce(new.id, old.id), now());

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Structure & roles
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'UTC',
  pco_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  address text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index locations_org_idx on locations(organization_id);

create table teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade, -- null = org-wide team
  name text not null,
  type text not null, -- e.g. medical, level_1, level_2, camera, custom — free text by design
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teams_org_idx on teams(organization_id);
create index teams_location_idx on teams(location_id);

create table members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  profile_picture_url text,
  status text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index members_org_idx on members(organization_id);
create index members_user_idx on members(user_id);

-- One person can hold different roles at different scopes: org_admin
-- everywhere, location_manager at one campus, team_lead on one team, plain
-- member elsewhere. This is what makes multi-campus leadership possible
-- without a manager column bolted onto every table.
create table role_assignments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  scope_type text not null check (scope_type in ('org', 'location', 'team')),
  scope_id uuid not null,
  role text not null check (role in ('org_admin', 'location_manager', 'team_lead', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, scope_type, scope_id, role)
);
create index role_assignments_member_idx on role_assignments(member_id);
create index role_assignments_scope_idx on role_assignments(scope_type, scope_id);

-- ---------------------------------------------------------------------------
-- Documents (created early — several tables below reference it)
-- ---------------------------------------------------------------------------

create table documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  category text not null check (category in ('policy', 'sop', 'emergency_plan', 'certificate', 'training_material', 'other')),
  storage_path text not null, -- private bucket path: org_id/category/filename — signed URLs only, see brief §06
  version integer not null default 1,
  uploaded_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_org_idx on documents(organization_id);

-- ---------------------------------------------------------------------------
-- Scheduling & training
-- ---------------------------------------------------------------------------

create table certifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  type text not null,
  issued_at date,
  expires_at date,
  document_id uuid references documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index certifications_member_idx on certifications(member_id);
create index certifications_expiry_idx on certifications(expires_at);

-- Its own table, not a status flag on members: screening has a provider, a
-- result, and a re-screening cycle, and needs to feed the same expiry-
-- reminder jobs as certifications. See brief §04.
create table background_checks (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  provider text,
  status text not null default 'pending' check (status in ('pending', 'clear', 'flagged', 'expired')),
  level text,
  requested_at timestamptz,
  completed_at timestamptz,
  expires_at date,
  document_id uuid references documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index background_checks_member_idx on background_checks(member_id);
create index background_checks_expiry_idx on background_checks(expires_at);

create table trainings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  renewal_period_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trainings_org_idx on trainings(organization_id);

create table training_completions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  training_id uuid not null references trainings(id) on delete cascade,
  completed_at date not null default current_date,
  expires_at date,
  document_id uuid references documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_completions_member_idx on training_completions(member_id);
create index training_completions_expiry_idx on training_completions(expires_at);

-- type distinguishes real services from drills/meetings; source distinguishes
-- events mirrored from Planning Center from ones created directly in-app, so
-- a safety drill can be scheduled without needing a matching PCO event.
create table events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  pco_event_id text,
  title text not null,
  start_time timestamptz not null,
  type text not null default 'service' check (type in ('service', 'drill', 'meeting')),
  source text not null default 'internal' check (source in ('planning_center', 'internal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_org_idx on events(organization_id);
create index events_location_idx on events(location_id);
create unique index events_pco_id_idx on events(organization_id, pco_event_id) where pco_event_id is not null;

create table assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  role text,
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignments_event_idx on assignments(event_id);
create index assignments_member_idx on assignments(member_id);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  method text not null default 'manual' check (method in ('qr', 'geofence', 'manual')),
  created_at timestamptz not null default now()
);
create index attendance_member_idx on attendance(member_id);
create index attendance_event_idx on attendance(event_id);

-- ---------------------------------------------------------------------------
-- Sensitive & security-specific data
-- ---------------------------------------------------------------------------

-- Most restricted table in the schema — see brief §06. Not exposed via the
-- auto-generated REST API in the app layer; reads should go through an
-- audited Edge Function even though RLS below also locks it down.
create table watchlist_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade, -- null = org-wide
  name text not null,
  photo_url text,
  description text,
  reason text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index watchlist_org_idx on watchlist_entries(organization_id);
create index watchlist_location_idx on watchlist_entries(location_id);

create table incident_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  reported_by uuid references members(id) on delete set null,
  occurred_at timestamptz not null default now(),
  type text not null check (type in ('medical', 'disruptive_person', 'fire', 'weapon', 'accident', 'near_miss', 'other')),
  narrative text not null,
  watchlist_entry_id uuid references watchlist_entries(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'closed')),
  signed_at timestamptz,
  signed_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index incident_reports_org_idx on incident_reports(organization_id);
create index incident_reports_location_idx on incident_reports(location_id);

-- Once signed, the narrative is locked — only status/follow-up fields may
-- still change, mirroring how a signed paper report would be handled.
create or replace function public.enforce_incident_report_immutability()
returns trigger language plpgsql as $$
begin
  if old.signed_at is not null and new.narrative is distinct from old.narrative then
    raise exception 'incident_reports.narrative cannot be changed after the report is signed';
  end if;
  return new;
end;
$$;

create table equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  type text not null, -- radio, aed, first_aid_kit, key, camera, ...
  identifier text,
  assigned_to uuid references members(id) on delete set null,
  last_inspected_at date,
  next_inspection_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index equipment_org_idx on equipment(organization_id);
create index equipment_location_idx on equipment(location_id);

-- Phase 2 (roadmap) — AI-generated, human-reviewed before release. Table
-- exists now so the rest of the schema doesn't need to change when it ships.
create table threat_reports (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  generated_at timestamptz not null default now(),
  summary text,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'released')),
  source_refs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index threat_reports_location_idx on threat_reports(location_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  channel text not null check (channel in ('email', 'sms')),
  recipient text not null,
  template text not null,
  sent_at timestamptz,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'delivered')),
  created_at timestamptz not null default now()
);
create index notifications_org_idx on notifications(organization_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_type text not null default 'org_member' check (actor_type in ('org_member', 'platform_admin', 'system')),
  organization_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  occurred_at timestamptz not null default now()
);
create index audit_logs_org_idx on audit_logs(organization_id);
create index audit_logs_record_idx on audit_logs(table_name, record_id);

-- ---------------------------------------------------------------------------
-- Platform administration (SafeCampus staff — outside every org's scope)
-- See brief §07. Intentionally has zero RLS policies below: with RLS enabled
-- and no policy, only the service_role (used exclusively by the future
-- Support Console, server-side) can touch these two tables at all.
-- ---------------------------------------------------------------------------

create table platform_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table support_access_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  platform_admin_id uuid not null references platform_admins(id) on delete cascade,
  reason text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index support_grants_org_idx on support_access_grants(organization_id);
create index support_grants_admin_idx on support_access_grants(platform_admin_id);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at bookkeeping + audit log on the sensitive tables
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'locations', 'teams', 'members', 'role_assignments',
    'documents', 'certifications', 'background_checks', 'trainings',
    'training_completions', 'events', 'assignments', 'watchlist_entries',
    'incident_reports', 'equipment', 'threat_reports'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'role_assignments', 'certifications', 'background_checks',
    'watchlist_entries', 'documents', 'incident_reports'
  ]
  loop
    execute format(
      'create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function public.record_audit_log();',
      t
    );
  end loop;
end $$;

create trigger incident_reports_immutable
  before update on incident_reports
  for each row execute function public.enforce_incident_report_immutability();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
alter table locations enable row level security;
alter table teams enable row level security;
alter table members enable row level security;
alter table role_assignments enable row level security;
alter table documents enable row level security;
alter table certifications enable row level security;
alter table background_checks enable row level security;
alter table trainings enable row level security;
alter table training_completions enable row level security;
alter table events enable row level security;
alter table assignments enable row level security;
alter table attendance enable row level security;
alter table watchlist_entries enable row level security;
alter table incident_reports enable row level security;
alter table equipment enable row level security;
alter table threat_reports enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
-- platform_admins and support_access_grants: RLS enabled, no policies —
-- service_role (Support Console) only. See comment above.
alter table platform_admins enable row level security;
alter table support_access_grants enable row level security;

-- organizations: readable by your own org; created/managed via a service-role
-- onboarding flow, not directly by clients.
create policy "read own organization" on organizations
  for select using (id in (select current_org_ids()));

-- locations, teams: read by any org member; managed by org_admin.
create policy "read own org locations" on locations
  for select using (organization_id in (select current_org_ids()));
create policy "manage own org locations" on locations
  for insert with check (is_org_admin(organization_id));
create policy "update own org locations" on locations
  for update using (is_org_admin(organization_id));
create policy "delete own org locations" on locations
  for delete using (is_org_admin(organization_id));

create policy "read own org teams" on teams
  for select using (organization_id in (select current_org_ids()));
create policy "manage own org teams" on teams
  for insert with check (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)));
create policy "update own org teams" on teams
  for update using (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)));
create policy "delete own org teams" on teams
  for delete using (is_org_admin(organization_id));

-- members: roster visible org-wide; a member can update their own profile,
-- org_admin manages everyone. Row creation happens via the onboarding flow.
create policy "read own org roster" on members
  for select using (organization_id in (select current_org_ids()));
create policy "update own profile or admin" on members
  for update using (user_id = auth.uid() or is_org_admin(organization_id));
create policy "admin manages members" on members
  for insert with check (is_org_admin(organization_id));
create policy "admin removes members" on members
  for delete using (is_org_admin(organization_id));

-- role_assignments: visible to the org (so people can see who leads what);
-- only org_admin grants or revokes roles.
create policy "read own org role assignments" on role_assignments
  for select using (
    exists (select 1 from members m where m.id = role_assignments.member_id and m.organization_id in (select current_org_ids()))
  );
create policy "admin manages role assignments" on role_assignments
  for insert with check (
    exists (select 1 from members m where m.id = role_assignments.member_id and is_org_admin(m.organization_id))
  );
create policy "admin updates role assignments" on role_assignments
  for update using (
    exists (select 1 from members m where m.id = role_assignments.member_id and is_org_admin(m.organization_id))
  );
create policy "admin removes role assignments" on role_assignments
  for delete using (
    exists (select 1 from members m where m.id = role_assignments.member_id and is_org_admin(m.organization_id))
  );

-- documents: readable org-wide (policies/SOPs are meant to be seen); managed
-- by org_admin or the manager of the document's location.
create policy "read own org documents" on documents
  for select using (organization_id in (select current_org_ids()));
create policy "manage own org documents" on documents
  for insert with check (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)));
create policy "update own org documents" on documents
  for update using (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)));
create policy "delete own org documents" on documents
  for delete using (is_org_admin(organization_id));

-- certifications: a member can see their own; org_admin sees/manages all.
create policy "read own certifications" on certifications
  for select using (
    exists (select 1 from members m where m.id = certifications.member_id and (m.user_id = auth.uid() or is_org_admin(m.organization_id)))
  );
create policy "admin manages certifications" on certifications
  for insert with check (exists (select 1 from members m where m.id = certifications.member_id and is_org_admin(m.organization_id)));
create policy "admin updates certifications" on certifications
  for update using (exists (select 1 from members m where m.id = certifications.member_id and is_org_admin(m.organization_id)));
create policy "admin deletes certifications" on certifications
  for delete using (exists (select 1 from members m where m.id = certifications.member_id and is_org_admin(m.organization_id)));

-- background_checks: same shape as certifications — self plus org_admin only.
-- Deliberately not extended to location_manager yet; narrow the read
-- audience until eligibility rules are finalized in the app layer.
create policy "read own background check" on background_checks
  for select using (
    exists (select 1 from members m where m.id = background_checks.member_id and (m.user_id = auth.uid() or is_org_admin(m.organization_id)))
  );
create policy "admin manages background checks" on background_checks
  for insert with check (exists (select 1 from members m where m.id = background_checks.member_id and is_org_admin(m.organization_id)));
create policy "admin updates background checks" on background_checks
  for update using (exists (select 1 from members m where m.id = background_checks.member_id and is_org_admin(m.organization_id)));
create policy "admin deletes background checks" on background_checks
  for delete using (exists (select 1 from members m where m.id = background_checks.member_id and is_org_admin(m.organization_id)));

-- trainings, training_completions: catalog readable org-wide; a member sees
-- their own completions, org_admin manages everything.
create policy "read own org trainings" on trainings
  for select using (organization_id in (select current_org_ids()));
create policy "admin manages trainings" on trainings
  for insert with check (is_org_admin(organization_id));
create policy "admin updates trainings" on trainings
  for update using (is_org_admin(organization_id));
create policy "admin deletes trainings" on trainings
  for delete using (is_org_admin(organization_id));

create policy "read own training completions" on training_completions
  for select using (
    exists (select 1 from members m where m.id = training_completions.member_id and (m.user_id = auth.uid() or is_org_admin(m.organization_id)))
  );
create policy "admin manages training completions" on training_completions
  for insert with check (exists (select 1 from members m where m.id = training_completions.member_id and is_org_admin(m.organization_id)));
create policy "admin updates training completions" on training_completions
  for update using (exists (select 1 from members m where m.id = training_completions.member_id and is_org_admin(m.organization_id)));
create policy "admin deletes training completions" on training_completions
  for delete using (exists (select 1 from members m where m.id = training_completions.member_id and is_org_admin(m.organization_id)));

-- events, assignments, attendance: operational data, readable org-wide,
-- managed by org_admin or the relevant location_manager.
create policy "read own org events" on events
  for select using (organization_id in (select current_org_ids()));
create policy "manage own org events" on events
  for insert with check (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)));
create policy "update own org events" on events
  for update using (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)));
create policy "delete own org events" on events
  for delete using (is_org_admin(organization_id));

create policy "read own org assignments" on assignments
  for select using (exists (select 1 from events e where e.id = assignments.event_id and e.organization_id in (select current_org_ids())));
create policy "member updates own assignment status" on assignments
  for update using (
    exists (select 1 from members m where m.id = assignments.member_id and m.user_id = auth.uid())
    or exists (select 1 from events e where e.id = assignments.event_id and is_org_admin(e.organization_id))
  );
create policy "admin manages assignments" on assignments
  for insert with check (exists (select 1 from events e where e.id = assignments.event_id and is_org_admin(e.organization_id)));
create policy "admin deletes assignments" on assignments
  for delete using (exists (select 1 from events e where e.id = assignments.event_id and is_org_admin(e.organization_id)));

create policy "read own org attendance" on attendance
  for select using (
    exists (select 1 from members m where m.id = attendance.member_id and (m.user_id = auth.uid() or m.organization_id in (select current_org_ids())))
  );
create policy "member checks self in" on attendance
  for insert with check (exists (select 1 from members m where m.id = attendance.member_id and m.user_id = auth.uid()));
create policy "admin or location manager records attendance" on attendance
  for insert with check (
    exists (select 1 from members m where m.id = attendance.member_id and is_org_admin(m.organization_id))
    or (attendance.location_id is not null and is_location_manager(attendance.location_id))
  );
create policy "member or admin updates attendance" on attendance
  for update using (
    exists (select 1 from members m where m.id = attendance.member_id and (m.user_id = auth.uid() or is_org_admin(m.organization_id)))
    or (attendance.location_id is not null and is_location_manager(attendance.location_id))
  );

-- watchlist_entries: the narrowest policy in the schema — org_admin, or the
-- location_manager of that specific location. Never team_lead or member.
create policy "restricted watchlist read" on watchlist_entries
  for select using (
    is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id))
  );
create policy "restricted watchlist write" on watchlist_entries
  for insert with check (
    is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id))
  );
create policy "restricted watchlist update" on watchlist_entries
  for update using (
    is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id))
  );
create policy "restricted watchlist delete" on watchlist_entries
  for delete using (is_org_admin(organization_id));

-- incident_reports: org_admin or the location's manager can read/file;
-- narrative immutability after signing is enforced by trigger, not RLS.
create policy "restricted incident read" on incident_reports
  for select using (is_org_admin(organization_id) or is_location_manager(location_id));
create policy "restricted incident write" on incident_reports
  for insert with check (is_org_admin(organization_id) or is_location_manager(location_id));
create policy "restricted incident update" on incident_reports
  for update using (is_org_admin(organization_id) or is_location_manager(location_id));

create policy "read own org equipment" on equipment
  for select using (organization_id in (select current_org_ids()));
create policy "manage own org equipment" on equipment
  for insert with check (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)));
create policy "update own org equipment" on equipment
  for update using (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)));
create policy "delete own org equipment" on equipment
  for delete using (is_org_admin(organization_id));

-- threat_reports (Phase 2): same audience as incident_reports.
create policy "restricted threat report read" on threat_reports
  for select using (is_location_manager(location_id));
create policy "restricted threat report write" on threat_reports
  for insert with check (is_location_manager(location_id));
create policy "restricted threat report update" on threat_reports
  for update using (is_location_manager(location_id));

create policy "read own org notifications" on notifications
  for select using (organization_id in (select current_org_ids()));

-- audit_logs: org_admin can review their own org's trail; rows are written
-- only by record_audit_log() (table-owner insert, bypasses RLS).
create policy "admin reads own org audit log" on audit_logs
  for select using (organization_id is not null and is_org_admin(organization_id));
