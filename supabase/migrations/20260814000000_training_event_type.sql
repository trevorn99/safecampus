-- Adds "training" as a real event type, so trainings can be scheduled like
-- any other event and attendance recorded against them (see attendance
-- table, already fully modeled with RLS in the init migration but never
-- surfaced in the app until now).
alter table events drop constraint events_type_check;
alter table events add constraint events_type_check check (type in ('service', 'drill', 'meeting', 'training'));

alter table event_series drop constraint event_series_type_check;
alter table event_series add constraint event_series_type_check check (type in ('service', 'drill', 'meeting', 'training'));
