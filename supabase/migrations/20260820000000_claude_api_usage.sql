-- Ledger of Anthropic API consumption per organization, the same shape as
-- x_api_usage (20260811000000) and for the same reason: the spend is
-- per-organization and driven by customer-controlled input, but nothing
-- recorded it, so the only view of it was an aggregate monthly invoice.
--
-- Threat Intelligence report generation is currently the only thing in the
-- app that calls Claude. Unlike the X ledger, this one doesn't gate
-- anything — the prompt is bounded at build time instead (see
-- MAX_INCIDENTS / MAX_PROMPT_TOKENS in lib/threatIntelligence.ts) — it
-- exists so a platform admin can see what an organization actually costs.
create table claude_api_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  model text not null,
  -- One row per API call, so a report that resumes after a pause_turn
  -- writes several; report_id ties them together. Deliberately "on delete
  -- set null": a failed generation deletes its own placeholder row, and the
  -- tokens it burned before failing still need to be counted.
  report_id uuid references threat_reports(id) on delete set null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  -- usage.server_tool_use.web_search_requests — billed per search on top of
  -- the tokens the results consume.
  web_search_requests integer not null default 0
);

create index claude_api_usage_org_time_idx on claude_api_usage (organization_id, occurred_at);

alter table claude_api_usage enable row level security;

-- Only the service-role client writes here, and the platform-admin console
-- reads it the same way (like the billing columns on organizations, which
-- have no client policy either). This policy just lets org admins see their
-- own organization's consumption, matching x_api_usage.
create policy "org admin reads claude api usage" on claude_api_usage
  for select using (is_org_admin(organization_id));
