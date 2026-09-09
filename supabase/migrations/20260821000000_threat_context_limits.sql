-- threat_context, at both the org and location level, is interpolated
-- straight into the Threat Intelligence prompt. It had no length limit
-- anywhere, so a single paste into that textarea could turn every weekly
-- report for that organization into a full-context request — the cost lives
-- in the database, where no per-request rate limit can reach it.
--
-- The constraint has to be in the database rather than in a route: the
-- per-location value is written directly from the browser through RLS (see
-- ThreatContextForm), so no server code ever sees it. /api/org/update-
-- threat-context checks the same limit first, only to return a readable
-- error instead of a raw constraint violation.
--
-- 2000 characters is roughly 400 words — far more than the "what should the
-- analyst know about us" note this field is for.
alter table organizations
  add constraint organizations_threat_context_length
  check (threat_context is null or length(threat_context) <= 2000) not valid;

alter table locations
  add constraint locations_threat_context_length
  check (threat_context is null or length(threat_context) <= 2000) not valid;

-- NOT VALID: enforced on every insert and update from here on, but no scan
-- of existing rows, so this can't fail on data already in the table. To
-- enforce it retroactively, first look for violations:
--   select id, length(threat_context) from organizations
--     where length(threat_context) > 2000;
--   select id, length(threat_context) from locations
--     where length(threat_context) > 2000;
-- then shorten what turns up and run:
--   alter table organizations validate constraint organizations_threat_context_length;
--   alter table locations validate constraint locations_threat_context_length;
