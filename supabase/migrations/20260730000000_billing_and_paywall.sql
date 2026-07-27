-- Per-seat billing (Stripe) with a time-limited trial, and a platform-admin
-- bypass for organizations that shouldn't be paywalled (e.g. internal demo
-- orgs, partners). Billing fields are only ever written by the Stripe
-- webhook handler or the platform-admin console, both service_role — same
-- "no client insert/update policy" pattern organizations already uses for
-- pco_connected/name, so no new RLS policies are needed here.

alter table organizations
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  add column trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column paywall_exempt boolean not null default false;

-- Single choke point the app checks: exempt orgs, active subscriptions, and
-- orgs still inside their trial window all get through. Security definer so
-- it can be called from requireMembership() using the caller's own session.
create or replace function public.has_active_access(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organizations
    where id = target_org
      and (
        paywall_exempt
        or subscription_status = 'active'
        or (subscription_status = 'trialing' and trial_ends_at > now())
      )
  );
$$;

-- platform_admins has RLS enabled with zero policies (see init migration),
-- so the calling role can't select it directly. This lets the platform-admin
-- console gate itself using the caller's own session instead of reaching
-- for the service-role client just to answer "am I a platform admin".
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where id = auth.uid());
$$;
