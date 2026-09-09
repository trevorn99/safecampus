-- Scheduling people before they've accepted an invite. An org can create a
-- member row, put it on teams, and assign it to positions straight away;
-- when that person finally signs in, their account is linked to the row
-- that's already on the schedule rather than starting a second, empty one.
--
-- No new columns — the three states already fall out of the two we have:
--   user_id null, status 'pending'  -> on the roster, never invited
--   user_id set,  status 'pending'  -> invited, hasn't signed in yet
--   user_id set,  status 'active'   -> joined
-- members.user_id is already nullable, and the unique (organization_id,
-- user_id) constraint from init_schema.sql ignores nulls, so any number of
-- never-invited members can sit in one org. Billing is unaffected either
-- way: syncPlanTier only counts 'active' members, so a pre-scheduled person
-- costs a seat at the moment they join, not before.

-- Linking happens by email address at sign-in (see lib/claimMembership.ts),
-- which needs the stored addresses to be directly comparable — no ILIKE,
-- whose wildcards would make an underscore in a local part match anything.
-- Normalize what's already there; every write path stores lowercase from
-- here on (auth.users.email always was, and /api/team/invite now lowercases
-- what an admin types).
update members
  set email = lower(trim(email))
  where email is not null and email <> lower(trim(email));

create index members_email_idx on members(email) where email is not null;
