-- Mirrors event_positions.end_time: optional, no ordering check constraint
-- (same convention used there).
alter table events add column end_time timestamptz;
