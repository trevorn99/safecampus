-- Payment links: an org admin asks someone outside the organization — a
-- church treasurer, a school business office — to pay for the
-- subscription, without that person needing an account.
--
-- The link is a bearer credential for exactly one thing: starting checkout
-- for this organization's plan. It shows the organization's name and plan,
-- nothing from inside the organization, and grants no access to the app.
-- Only a SHA-256 hash of the token is stored, so this table can't be used
-- to reconstruct a working link.
create table billing_payment_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  token_hash text not null unique,
  payer_email text not null,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index billing_payment_links_org_idx on billing_payment_links (organization_id, created_at desc);

alter table billing_payment_links enable row level security;

-- Org admins can see their organization's links on the Billing page.
-- Creating, revoking and redeeming all go through server routes with the
-- service-role client, so there are no write policies.
create policy "org admin reads payment links" on billing_payment_links
  for select using (is_org_admin(organization_id));
