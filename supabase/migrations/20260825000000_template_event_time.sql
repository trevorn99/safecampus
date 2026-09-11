-- A template's usual time of day, so creating an event from one fills in
-- when it happens as well as who works it. Positions already carry offsets
-- from the event start; this is the start they're offset from.
--
-- Stored as a bare time plus a length rather than a start/end pair: a
-- template has no date, and every event made from it lands on a different
-- one. The forms present it as "starts" and "ends" — matching how a series
-- is edited — and derive the length from the two.
alter table event_templates
  add column default_start_time time,
  add column default_duration_minutes integer check (default_duration_minutes is null or default_duration_minutes > 0);

-- Both nullable: templates created before this have no time on file, and a
-- template that is only a set of positions remains perfectly valid.
