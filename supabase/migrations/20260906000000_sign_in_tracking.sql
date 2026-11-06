-- Sign-in and registration figures for the Analytics page.

-- One row per completed sign-in, written by the app after a session is
-- established (lib/postSignIn.ts). Supabase keeps only each account's most
-- recent sign-in, so without this there is no history: no "sign-ins per
-- day", only "last seen".
create table member_sign_ins (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  method text not null check (method in ('email_code', 'email_link', 'google')),
  signed_in_at timestamptz not null default now()
);

create index member_sign_ins_org_time_idx on member_sign_ins (organization_id, signed_in_at);

alter table member_sign_ins enable row level security;

-- Written only by the service-role client; org admins can read their own.
create policy "org admin reads sign-ins" on member_sign_ins
  for select using (is_org_admin(organization_id));

-- When each member was invited, accepted, last signed in, and whether they
-- have two-factor set up. All of it lives in auth.users / auth.mfa_factors,
-- which no client can read, so this exposes exactly those columns, for one
-- organization, to that organization's admins. Members not yet linked to an
-- account have no auth row and simply don't appear.
create or replace function public.org_member_auth_summary(target_org uuid)
returns table (
  member_id uuid,
  invited_at timestamptz,
  confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  has_mfa boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    u.invited_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    exists (
      select 1 from auth.mfa_factors f
      where f.user_id = u.id and f.status = 'verified'
    )
  from members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = target_org
    -- The gate. Anyone else gets no rows rather than an error, the same
    -- as RLS would give them.
    and is_org_admin(target_org);
$$;

revoke all on function public.org_member_auth_summary(uuid) from public;
grant execute on function public.org_member_auth_summary(uuid) to authenticated;
