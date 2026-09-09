-- Email shift reminders, running alongside the SMS ones from
-- 20260806000000_sms_reminders.sql. The two channels are independent
-- opt-ins, not a fallback chain: a member with both on gets both the text
-- and the email for each reminder window.
--
-- Unlike SMS, email defaults to ON. Members already hand over an email
-- address to be invited, a shift reminder is transactional rather than
-- marketing, and SendGrid is already the delivery path for the sign-in and
-- invite mail they receive anyway. Every reminder carries a one-click
-- unsubscribe link (email's answer to replying STOP), so turning it off
-- never requires signing in.
alter table members
  add column email_opt_in boolean not null default true,
  add column email_opt_in_at timestamptz;
-- members.email already exists (init_schema.sql) and is reused here, the
-- same way the SMS migration reused members.phone.

-- No unsubscribe-token column on purpose: "read own org roster" lets every
-- member select every column of every colleague's row, which would hand
-- them each other's unsubscribe tokens. The token is derived instead —
-- HMAC(EMAIL_UNSUBSCRIBE_SECRET, member id), see lib/email.ts — so there
-- is nothing in the table to leak.

-- Same master switch shape as organizations.sms_enabled: no RLS update
-- policy for this column, since the org-admin toggle route goes through the
-- service-role client after its own is_org_admin() check.
alter table organizations
  add column email_enabled boolean not null default true;

-- notifications.channel already allows 'email' (init_schema.sql), and the
-- notifications_dedup_idx from the SMS migration is on
-- (related_id, template, channel) — so the email and SMS copies of the same
-- reminder dedup independently without any schema change here.
