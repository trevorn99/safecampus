-- Self-service certification uploads, plus location maps with position pins.

-- ---------------------------------------------------------------------------
-- Storage: one private bucket for both certification files and map images,
-- distinguished by path convention: {organization_id}/{category}/{...}.
-- The bucket itself being permissive on INSERT is fine — what actually gates
-- whether an uploaded file *means* anything is the corresponding row in
-- certifications/maps, which keep their own stricter RLS below. An orphan
-- file with no matching row is inert; nothing in the app surfaces it.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('org-files', 'org-files', false)
on conflict (id) do nothing;

create policy "org members read their org files" on storage.objects
  for select using (
    bucket_id = 'org-files'
    and (storage.foldername(name))[1]::uuid in (select current_org_ids())
  );

create policy "org members upload to their org folder" on storage.objects
  for insert with check (
    bucket_id = 'org-files'
    and (storage.foldername(name))[1]::uuid in (select current_org_ids())
  );

-- Replace/delete: the uploader themselves, or an org_admin for that org.
create policy "owner or admin updates org files" on storage.objects
  for update using (
    bucket_id = 'org-files'
    and (owner = auth.uid() or is_org_admin((storage.foldername(name))[1]::uuid))
  );

create policy "owner or admin deletes org files" on storage.objects
  for delete using (
    bucket_id = 'org-files'
    and (owner = auth.uid() or is_org_admin((storage.foldername(name))[1]::uuid))
  );

-- ---------------------------------------------------------------------------
-- Certifications: allow self-submission, not just admin entry.
-- ---------------------------------------------------------------------------

drop policy "admin manages certifications" on certifications;
drop policy "admin updates certifications" on certifications;

create policy "self or admin inserts certifications" on certifications
  for insert with check (
    exists (select 1 from members m where m.id = certifications.member_id and (m.user_id = auth.uid() or is_org_admin(m.organization_id)))
  );
create policy "self or admin updates certifications" on certifications
  for update using (
    exists (select 1 from members m where m.id = certifications.member_id and (m.user_id = auth.uid() or is_org_admin(m.organization_id)))
  );
-- delete stays admin-only (existing "admin deletes certifications" policy).

-- ---------------------------------------------------------------------------
-- Maps: an image per location, with pins placed on named template positions.
-- Pins target the position template rather than a specific event's concrete
-- position, since where "Main Entrance" physically stands doesn't change
-- week to week — every event generated from that template inherits its pin.
-- ---------------------------------------------------------------------------

create table maps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id)
);
create index maps_org_idx on maps(organization_id);

create table map_pins (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps(id) on delete cascade,
  template_position_id uuid not null references template_positions(id) on delete cascade,
  x_pct numeric(5, 2) not null check (x_pct >= 0 and x_pct <= 100),
  y_pct numeric(5, 2) not null check (y_pct >= 0 and y_pct <= 100),
  created_at timestamptz not null default now(),
  unique (map_id, template_position_id)
);
create index map_pins_map_idx on map_pins(map_id);

alter table maps enable row level security;
alter table map_pins enable row level security;

create policy "read own org maps" on maps
  for select using (organization_id in (select current_org_ids()));
create policy "manage own org maps" on maps
  for insert with check (is_org_admin(organization_id) or is_location_manager(location_id));
create policy "update own org maps" on maps
  for update using (is_org_admin(organization_id) or is_location_manager(location_id));
create policy "delete own org maps" on maps
  for delete using (is_org_admin(organization_id));

create policy "read own org map pins" on map_pins
  for select using (
    exists (select 1 from maps mp where mp.id = map_pins.map_id and mp.organization_id in (select current_org_ids()))
  );
create policy "manage own org map pins" on map_pins
  for insert with check (
    exists (select 1 from maps mp where mp.id = map_pins.map_id and (is_org_admin(mp.organization_id) or is_location_manager(mp.location_id)))
  );
create policy "delete own org map pins" on map_pins
  for delete using (
    exists (select 1 from maps mp where mp.id = map_pins.map_id and (is_org_admin(mp.organization_id) or is_location_manager(mp.location_id)))
  );

do $$
begin
  execute 'create trigger set_updated_at before update on maps for each row execute function public.set_updated_at();';
end $$;
