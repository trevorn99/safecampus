-- Planning Center's EventInstance resource carries ends_at alongside
-- starts_at — we just weren't capturing it, since events.end_time didn't
-- exist yet when this table was first built.
alter table pco_imported_events add column ends_at timestamptz;
