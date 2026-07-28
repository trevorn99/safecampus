-- Planning Center OAuth connection storage. organizations.pco_connected
-- (from the init migration) has been an unused flag until now — kept as a
-- cheap convenience read; the actual tokens live here.
--
-- Each organization registers its own Planning Center OAuth application
-- (in their own PCO developer account) rather than sharing one platform-
-- wide app — the org admin provides its client ID/secret here. That's a
-- deliberate choice, not a shortcut: it keeps each org's PCO access
-- independently auditable/revocable from their own PCO account, and
-- avoids SafeCampus needing to operate a single shared OAuth app that all
-- customer orgs' data would flow through.
--
-- Zero client policies, same pattern as platform_admins: these credentials
-- and tokens are as sensitive as any other server credential and should
-- never be reachable from the browser, even for the org's own admin. Every
-- interaction goes through the service-role client via the API routes in
-- src/lib/planningCenter.ts.

create table pco_app_credentials (
  organization_id uuid primary key references organizations(id) on delete cascade,
  client_id text not null,
  client_secret text not null,
  saved_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pco_app_credentials enable row level security;

create trigger set_updated_at before update on pco_app_credentials
  for each row execute function public.set_updated_at();

create table pco_connections (
  organization_id uuid primary key references organizations(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  connected_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pco_connections enable row level security;

create trigger set_updated_at before update on pco_connections
  for each row execute function public.set_updated_at();

-- Importing does NOT create SafeCampus events directly — not every PCO
-- calendar entry needs a safety team presence. It stages candidates here;
-- an admin selectively "promotes" one into a real event (via /schedule/new,
-- prefilled), which is the only thing that ever writes to `events`.
create table pco_imported_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  pco_event_id text not null,
  title text not null,
  starts_at timestamptz not null,
  promoted_event_id uuid references events(id) on delete set null,
  imported_at timestamptz not null default now(),
  unique (organization_id, pco_event_id)
);
create index pco_imported_events_org_idx on pco_imported_events(organization_id);

alter table pco_imported_events enable row level security;

-- Any org member can see what's available to promote. Importing (the
-- service-role job that calls the PCO API) is the only way rows get
-- created; marking one promoted is a normal admin update, done inline by
-- the same event-creation flow that writes to `events`.
create policy "read own org pco imports" on pco_imported_events
  for select using (organization_id in (select current_org_ids()));
create policy "admin marks own org pco imports promoted" on pco_imported_events
  for update using (is_org_admin(organization_id));
