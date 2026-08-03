-- Tracks X (Twitter) API read consumption per organization. X's pay-per-use
-- search pricing ($0.005/read) has no built-in per-account spend cap, so
-- this ledger is what MAX_X_READS_PER_ORG_PER_MONTH (src/lib/xSearch.ts)
-- checks against before running any query, and what each completed query
-- appends a row to afterward.
create table x_api_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  reads_used integer not null,
  query text not null
);

create index x_api_usage_org_time_idx on x_api_usage (organization_id, occurred_at);

alter table x_api_usage enable row level security;

-- Only the service-role client writes here (bypasses RLS); this policy just
-- lets org admins see their own organization's spend for transparency.
create policy "org admin reads x api usage" on x_api_usage
  for select using (is_org_admin(organization_id));
