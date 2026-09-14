-- Regulars belong to a series' position, not a template's.
--
-- Several series can share one template — "2nd Sunday 2nd Service" and "3rd
-- Sunday 3rd Service" are different series built from the same set of
-- positions. template_position_assignments keyed only on the template
-- position, so both series drew their regulars from one list: adding someone
-- to one put them on the other, and removing them took them off both. The
-- fan-out had the same hole, since it matched every future event_position
-- carrying that template_position_id regardless of which series it belonged
-- to.
alter table template_position_assignments
  add column series_id uuid references event_series(id) on delete cascade;

-- Every existing row becomes one row per series using its template. That
-- preserves what the app was actually doing — a shared list — rather than
-- silently picking one series and dropping the person from the others, which
-- would quietly unassign people nobody asked to unassign.
insert into template_position_assignments (template_position_id, member_id, series_id)
select tpa.template_position_id, tpa.member_id, s.id
from template_position_assignments tpa
join template_positions tp on tp.id = tpa.template_position_id
join event_series s on s.template_id = tp.template_id
where tpa.series_id is null
on conflict do nothing;

-- The originals, now superseded by their per-series copies.
delete from template_position_assignments where series_id is null;

alter table template_position_assignments
  alter column series_id set not null;

-- The old key allowed one entry per (position, member) across every series.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'template_position_assignments' and con.contype = 'u';

  if constraint_name is not null then
    execute format('alter table template_position_assignments drop constraint %I', constraint_name);
  end if;
end $$;

create unique index template_position_assignments_unique_idx
  on template_position_assignments(series_id, template_position_id, member_id);

create index template_position_assignments_series_idx
  on template_position_assignments(series_id);
