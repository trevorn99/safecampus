-- Lets a user skip the interactive MFA prompt on a given browser for up to
-- 30 days. Deliberately scoped to our own app-level gate only (the redirect
-- to /auth/mfa-challenge in requireMembership()/the auth callback) — it does
-- NOT and cannot make Supabase's own AAL2 claim true. watchlist_entries'
-- RLS checks is_aal2() directly against that real claim, so a "trusted"
-- device still can't read watchlist data without an actual fresh MFA
-- verification. See src/lib/trustedDevice.ts.
--
-- Zero client policies, same pattern as platform_admins: only the
-- service-role client (via the API routes) ever touches this table.

create table mfa_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  user_agent text
);
create unique index mfa_trusted_devices_token_hash_idx on mfa_trusted_devices(token_hash);
create index mfa_trusted_devices_user_idx on mfa_trusted_devices(user_id);

alter table mfa_trusted_devices enable row level security;
