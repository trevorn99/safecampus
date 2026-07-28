-- event_series had no `type` column, so every event generated from a series
-- silently defaulted to 'service' regardless of what was actually intended
-- (drill/meeting). Add it and carry it through generation.

alter table event_series
  add column type text not null default 'service' check (type in ('service', 'drill', 'meeting'));
