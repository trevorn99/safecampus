-- More than one map per location: a building has floors, and a campus has
-- buildings. maps already carried a name and was already the thing pins hang
-- off — the only thing stopping a second one was a unique constraint on
-- location_id, added when one image per location was the assumption.
-- Found by shape rather than by name: the constraint was declared inline as
-- `unique (location_id)`, so its name is whatever Postgres generated.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'maps'
    and con.contype = 'u'
    and con.conkey = array[(
      select attnum from pg_attribute
      where attrelid = rel.oid and attname = 'location_id'
    )];

  if constraint_name is not null then
    execute format('alter table maps drop constraint %I', constraint_name);
  end if;
end $$;

-- Names have to distinguish them now that there can be several. "Ground
-- floor" and "First floor" at the same location are different maps; two
-- called "Ground floor" would be indistinguishable in a picker.
create unique index maps_location_name_idx on maps(location_id, name);

-- Existing maps were named after the uploaded file, which is unique enough
-- in practice but reads badly in a picker ("floorplan-final-v2.png"). Nothing
-- is renamed automatically — that's a judgement call for whoever knows the
-- building — but the map page now lets an admin rename one.

-- A post stays location-scoped rather than map-scoped. A stairwell or a
-- lobby that spans two floors is genuinely one post, and pinning it on both
-- maps is a reasonable thing to want; map_pins' unique (map_id, post_id)
-- already stops it being pinned twice on the same map.
