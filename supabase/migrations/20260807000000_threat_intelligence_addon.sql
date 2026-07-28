-- Threat Intelligence: a $30/mo paid add-on on top of an org's existing
-- subscription (not a standalone plan). While active, AI-drafted reports for
-- each location refresh weekly and can also be generated on demand; a human
-- (location manager or org admin — same audience threat_reports already
-- restricts to) reviews and releases each one. See src/lib/threatIntelligence.ts.

alter table organizations
  add column threat_intel_enabled boolean not null default false,
  add column threat_context text;
-- No RLS update policy on organizations at all (pre-existing) — both
-- threat_intel_enabled (synced from Stripe) and threat_context (an org
-- admin's standing "about us" notes, fed into every location's report
-- prompt) are written via service-role API routes, not direct client RLS.

alter table locations
  add column threat_context text;
-- locations already has an org-admin update policy ("update own org
-- locations"), so this one *is* editable directly via the session client —
-- per-location concerns specific to that report, unlike the org-wide field.

alter table threat_reports
  add column reviewed_by uuid references members(id) on delete set null,
  add column reviewed_at timestamptz;
-- threat_reports already has a set_updated_at trigger (init_schema.sql).
