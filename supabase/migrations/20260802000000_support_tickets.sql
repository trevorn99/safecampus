-- Support requests submitted by org members. Screenshots reuse the existing
-- org-files bucket (category "support") — its storage RLS is already
-- generic per {organization_id}/{category}/..., so no storage policy
-- changes are needed here.

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  subject text not null,
  message text not null,
  attachment_paths text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_org_idx on support_tickets(organization_id);

alter table support_tickets enable row level security;

-- Any org member can see their org's tickets (so e.g. an admin can follow up
-- on a member's report), but can only ever create one as themselves.
-- Status changes are platform-admin-only, via the service-role client on
-- /platform-admin/support-tickets — no update policy for regular members.
create policy "read own org support tickets" on support_tickets
  for select using (organization_id in (select current_org_ids()));

create policy "members create own support tickets" on support_tickets
  for insert with check (
    organization_id in (select current_org_ids())
    and exists (select 1 from members m where m.id = support_tickets.member_id and m.user_id = auth.uid())
  );

create trigger set_updated_at before update on support_tickets
  for each row execute function public.set_updated_at();
