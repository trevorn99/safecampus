-- Threat Intelligence moves from one report per location to one combined
-- report per organization, covering every campus/location together — see
-- generateThreatReport() in src/lib/threatIntelligence.ts. location_id is
-- kept (nullable) for any historical per-location rows rather than deleting
-- data; new rows set organization_id and leave location_id null.

alter table threat_reports
  add column organization_id uuid references organizations(id) on delete cascade;

alter table threat_reports alter column location_id drop not null;

create index threat_reports_organization_idx on threat_reports(organization_id);

-- Backfill organization_id on any existing rows from their location, so
-- historical reports stay readable under the new policies below.
update threat_reports tr
  set organization_id = l.organization_id
  from locations l
  where tr.location_id = l.id and tr.organization_id is null;

drop policy "restricted threat report read" on threat_reports;
drop policy "restricted threat report write" on threat_reports;
drop policy "restricted threat report update" on threat_reports;

-- Org admin only now, not location managers: a combined report surfaces
-- incident/watchlist data from every campus in the org, which a single
-- location's manager shouldn't see via this report even though they can
-- see their own location's data directly elsewhere.
create policy "org admin reads threat reports" on threat_reports
  for select using (is_org_admin(organization_id));
create policy "org admin writes threat reports" on threat_reports
  for insert with check (is_org_admin(organization_id));
create policy "org admin updates threat reports" on threat_reports
  for update using (is_org_admin(organization_id));
