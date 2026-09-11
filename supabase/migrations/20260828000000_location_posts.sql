-- Physical posts, separated from event staffing requirements.
--
-- template_positions was doing two jobs: describing a place somebody stands
-- (the Lobby door at Main Campus) and describing what an event needs of it
-- (two people, from 30 minutes before until 15 after, from the Ushers team).
-- Only the second varies by event, but the first had no identity of its own —
-- it was borrowed from whichever template happened to define it.
--
-- That's why map pins targeted a template position: the same physical door
-- had to be pinned once per template, the pins could disagree with each
-- other, and a picker listing them showed "Lobby" once for every template
-- that mentioned one.
--
-- A post belongs to a location and nothing else. Staffing requirements point
-- at one when they happen to be a fixed place, and the link stays optional
-- permanently — "Roam" and "Camera" are real requirements that aren't a door.
create table location_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);
create index location_posts_org_idx on location_posts(organization_id);
create index location_posts_location_idx on location_posts(location_id);

alter table location_posts enable row level security;

-- Mirrors the locations and maps policies: the whole org can see where the
-- posts are, an org admin or the location's manager maintains them.
create policy "read own org posts" on location_posts
  for select using (organization_id in (select current_org_ids()));
create policy "manage own org posts" on location_posts
  for insert with check (is_org_admin(organization_id) or is_location_manager(location_id));
create policy "update own org posts" on location_posts
  for update using (is_org_admin(organization_id) or is_location_manager(location_id));
create policy "delete own org posts" on location_posts
  for delete using (is_org_admin(organization_id) or is_location_manager(location_id));

-- ---------------------------------------------------------------------------
-- Move the pins onto posts
-- ---------------------------------------------------------------------------

alter table map_pins
  add column post_id uuid references location_posts(id) on delete cascade;

-- One post per (location, title) among the positions that are actually
-- pinned. Those already have a location — it's the map's — so they convert
-- without guessing. Everything else stays unlinked and is connected in the
-- UI, which is why template_positions.post_id below is nullable.
insert into location_posts (organization_id, location_id, name)
select distinct m.organization_id, m.location_id, tp.title
from map_pins p
join maps m on m.id = p.map_id
join template_positions tp on tp.id = p.template_position_id
on conflict (location_id, name) do nothing;

update map_pins p
set post_id = lp.id
from maps m
join location_posts lp on lp.location_id = m.location_id
join template_positions tp on tp.title = lp.name
where m.id = p.map_id and tp.id = p.template_position_id;

-- Any pin that somehow didn't convert would violate the not-null below, so
-- drop it rather than fail the migration: a pin with no post is meaningless
-- and re-placing one is a click.
delete from map_pins where post_id is null;

alter table map_pins
  alter column post_id set not null,
  drop column template_position_id;

create unique index map_pins_map_post_idx on map_pins(map_id, post_id);

-- ---------------------------------------------------------------------------
-- Staffing requirements can name a post
-- ---------------------------------------------------------------------------

-- Nullable on purpose, and permanently so. Requiring it would force every
-- staffing requirement to be a fixed place, which "Roam" and "Camera" are
-- not. Posts are a mapping and reporting convenience, not a constraint.
alter table template_positions
  add column post_id uuid references location_posts(id) on delete set null;

-- Carried onto the concrete position too, rather than only reachable through
-- the template: positions added directly to a single event have no template
-- position to inherit from, and "who is covering the Lobby door" has to
-- include them.
alter table event_positions
  add column post_id uuid references location_posts(id) on delete set null;

create index template_positions_post_idx on template_positions(post_id);
create index event_positions_post_idx on event_positions(post_id);
