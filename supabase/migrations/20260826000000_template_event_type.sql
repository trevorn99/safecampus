-- A template's event type, alongside its usual time — so an event created
-- from one arrives already classified as a Service, a Training, or whatever
-- the organization calls it.
--
-- Plain text with no foreign key to event_types, deliberately matching
-- events.type and event_series.type. The custom-event-types migration made
-- that choice so renaming or deleting a type never breaks existing rows;
-- a template holding a type that has since been renamed is the same
-- situation, and should degrade the same way rather than cascade.
alter table event_templates
  add column default_type text;
