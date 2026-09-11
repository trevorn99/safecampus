-- Cancelled occurrences of a recurring series.
--
-- Deleting a series event on its own wasn't possible, and simply adding a
-- delete button would have been a lie: generateSeriesOccurrences decides what
-- to create by comparing the recurrence rule against the events that exist,
-- so a deleted occurrence reads as missing and the next cron run puts it
-- straight back. Cancelling one Sunday has to be recorded, not just enacted.
--
-- Keyed on the occurrence's exact start instant, which is what generation
-- compares against — the same value it would recreate.
create table event_series_skips (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references event_series(id) on delete cascade,
  occurs_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (series_id, occurs_at)
);

create index event_series_skips_series_idx on event_series_skips(series_id);

alter table event_series_skips enable row level security;

-- Mirrors the events policies: everyone in the org can see that an
-- occurrence was cancelled, org admins and the relevant location manager
-- cancel or restore one.
create policy "read own org series skips" on event_series_skips
  for select using (
    exists (
      select 1 from event_series s
      where s.id = event_series_skips.series_id and s.organization_id in (select current_org_ids())
    )
  );
create policy "manage own org series skips" on event_series_skips
  for insert with check (
    exists (
      select 1 from event_series s
      where s.id = event_series_skips.series_id
        and (is_org_admin(s.organization_id) or (s.location_id is not null and is_location_manager(s.location_id)))
    )
  );
create policy "remove own org series skips" on event_series_skips
  for delete using (
    exists (
      select 1 from event_series s
      where s.id = event_series_skips.series_id and is_org_admin(s.organization_id)
    )
  );
