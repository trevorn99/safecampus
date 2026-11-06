-- Announcements: a message an org admin, location manager or team lead
-- sends to the organization, to chosen teams, or to the team leads.
-- Delivered by email to every recipient regardless of their reminder
-- settings (they're rare, and an urgent one has to arrive), by text only to
-- those who opted in to texts, and as a dashboard banner until dismissed.

create table announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sender_member_id uuid references members(id) on delete set null,
  -- Kept as text so the history still says who sent it after the sender
  -- leaves the organization.
  sender_name text not null,
  subject text not null check (char_length(subject) between 1 and 150),
  body text not null check (char_length(body) between 1 and 5000),
  audience text not null check (audience in ('organization', 'teams', 'team_leads')),
  -- Names, not just ids, for the same reason as sender_name: a deleted team
  -- shouldn't turn "Medical, Parking" into a blank.
  audience_label text not null,
  team_ids uuid[] not null default '{}',
  sent_sms boolean not null default false,
  recipient_count integer not null default 0,
  email_count integer not null default 0,
  sms_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index announcements_org_time_idx on announcements (organization_id, created_at desc);

-- Who each announcement went to, and whether they've dismissed its
-- dashboard banner. organization_id is repeated here deliberately: it lets
-- this table's policy check admin rights without reading announcements,
-- whose own policy reads this table — the two referencing each other would
-- be rejected by Postgres as infinite recursion.
create table announcement_recipients (
  announcement_id uuid not null references announcements(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  dismissed_at timestamptz,
  primary key (announcement_id, member_id)
);

create index announcement_recipients_member_idx on announcement_recipients (member_id, dismissed_at);

alter table announcements enable row level security;
alter table announcement_recipients enable row level security;

-- Sent through a server route with the service-role client, so there are
-- no insert policies on either table.

create policy "read announcements" on announcements
  for select using (
    is_org_admin(organization_id)
    or exists (select 1 from members m where m.id = sender_member_id and m.user_id = auth.uid())
    or exists (
      select 1 from announcement_recipients r
      join members m on m.id = r.member_id
      where r.announcement_id = announcements.id and m.user_id = auth.uid()
    )
  );

create policy "read announcement receipts" on announcement_recipients
  for select using (
    is_org_admin(organization_id)
    or exists (select 1 from members m where m.id = member_id and m.user_id = auth.uid())
  );

-- A member can dismiss their own banner, and that is the only change they
-- can make: the column grant below limits updates to dismissed_at, so the
-- row can't be pointed at a different announcement or member.
create policy "dismiss own announcement" on announcement_recipients
  for update
  using (exists (select 1 from members m where m.id = member_id and m.user_id = auth.uid()))
  with check (exists (select 1 from members m where m.id = member_id and m.user_id = auth.uid()));

revoke update on announcement_recipients from authenticated;
grant update (dismissed_at) on announcement_recipients to authenticated;
