-- Identity Verification add-on: $10/mo, powered by Stripe Identity. Members
-- self-serve through a Stripe-hosted verification flow; results arrive
-- async via webhook (/api/identity/webhook), never synchronously — so
-- status is never set by the client directly (see the trigger below).

alter table organizations
  add column identity_verification_enabled boolean not null default false;

alter table members
  add column identity_verification_status text not null default 'unverified'
    check (identity_verification_status in ('unverified', 'pending', 'verified', 'failed')),
  add column identity_verification_error text,
  add column stripe_identity_session_id text;

-- "update own profile or admin" (init migration) lets a member freely
-- update their own row — name, phone, avatar — via the client. Without
-- this trigger, that same policy would let them set their own
-- verification status to 'verified' directly. Only a service-role write
-- (the webhook, or the session-creation route) may change these columns;
-- any authenticated-session write silently reverts them to their prior
-- value instead of erroring, so a legitimate profile-field update in the
-- same request isn't rejected outright.
create or replace function public.protect_identity_verification_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.identity_verification_status := old.identity_verification_status;
    new.identity_verification_error := old.identity_verification_error;
    new.stripe_identity_session_id := old.stripe_identity_session_id;
  end if;
  return new;
end;
$$;

create trigger protect_identity_verification_columns
  before update on members
  for each row
  execute function public.protect_identity_verification_columns();
