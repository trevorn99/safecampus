-- SMS shift reminders (3 days and 24 hours before a member's assigned
-- position). Opt-in is per-member; organizations get a master on/off switch
-- in case an org doesn't want SMS at all. Twilio is a single shared
-- platform-wide account (like SendGrid), not per-org credentials.

alter table members
  add column sms_opt_in boolean not null default false,
  add column sms_opt_in_at timestamptz;
-- members.phone already exists (init_schema.sql) and is reused here — no
-- separate phone column needed.

alter table organizations
  add column sms_enabled boolean not null default true;
-- No RLS update policy added for this column: like the platform-admin
-- exemption toggle, the org-admin toggle route goes through the
-- service-role client after its own is_org_admin() check, rather than
-- widening organizations' RLS surface.

-- Generic dedup handle for the notifications log, so the reminder cron can
-- tell "already sent this specific reminder" from "haven't sent it yet"
-- without a bespoke join table. Left null (and excluded from the unique
-- index) for one-off sends like the opt-in confirmation text, which don't
-- need dedup.
alter table notifications
  add column related_id uuid;
create unique index notifications_dedup_idx on notifications(related_id, template, channel)
  where related_id is not null;
