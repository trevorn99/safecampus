import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { utcToZonedWallTime } from "@/lib/timezone";
import { sendSms } from "@/lib/sms";
import { escapeHtml, sendEmail, unsubscribeUrlFor } from "@/lib/email";

// SignalWire currently throttles this account to 1 message/second —
// pace sends a bit under that rather than racing the exact boundary,
// where network jitter would occasionally trip the limit anyway.
// SendGrid has no comparable per-second cap at our volume, so the email
// pass below runs unpaced.
const SEND_INTERVAL_MS = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reminders are calendar-day based, not exact-hour based: a daily cron
// checks "is this position's local calendar date exactly N days ahead of
// today's local calendar date", rather than trying to hit a precise
// 72h/24h-before instant. That's a deliberate simplification — it means a
// 9pm event and a 6am event on the same day both get their reminder on the
// same run, which is the behavior people actually expect from "reminds you
// a few days before."
const REMINDER_WINDOWS = [
  { daysAhead: 3, template: "shift_reminder_3_day" },
  { daysAhead: 1, template: "shift_reminder_24_hour" },
] as const;

const TEMPLATES = REMINDER_WINDOWS.map((w) => w.template);

type PositionRow = {
  id: string;
  title: string;
  start_time: string;
  events: {
    id: string;
    title: string;
    organization_id: string;
    organizations: { id: string; timezone: string; sms_enabled: boolean; email_enabled: boolean } | null;
  } | null;
};

type AssignmentRow = {
  id: string;
  event_position_id: string;
  status: string;
  members: {
    id: string;
    user_id: string | null;
    phone: string | null;
    sms_opt_in: boolean;
    email: string | null;
    email_opt_in: boolean;
  } | null;
};

// One row per (assignment, reminder window) that's due today, carrying
// everything both channels need. Which channels it actually goes out on is
// decided per member: the two opt-ins are independent, so a member with
// both on gets the text and the email.
export type DueReminder = {
  assignmentId: string;
  memberId: string;
  organizationId: string;
  template: string;
  daysAhead: number;
  eventId: string;
  eventTitle: string;
  positionTitle: string;
  when: string;
  phone: string | null;
  email: string | null;
};

function localDayNumber(date: Date, timeZone: string): number {
  const wall = utcToZonedWallTime(date, timeZone);
  return Math.floor(Date.UTC(wall.year, wall.month - 1, wall.day) / 86_400_000);
}

function formatLocalDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function smsBody(due: DueReminder): string {
  return due.daysAhead === 3
    ? `SafeCampus reminder: you're on ${due.positionTitle} for ${due.eventTitle} on ${due.when}. Reply STOP to opt out.`
    : `SafeCampus reminder: you're on ${due.positionTitle} for ${due.eventTitle} tomorrow, ${due.when}. Reply STOP to opt out.`;
}

// Exported so /api/email/test sends the genuine article rather than a
// lookalike — a test that renders its own copy of the template proves
// nothing about the one that actually goes out.
export function buildReminderEmail(due: DueReminder, origin: string, unsubscribeUrl: string) {
  const subject =
    due.daysAhead === 3
      ? `Shift reminder: ${due.positionTitle} on ${due.when}`
      : `Tomorrow: ${due.positionTitle} at ${due.eventTitle}`;
  const lead =
    due.daysAhead === 3
      ? `You're scheduled for ${due.positionTitle} at ${due.eventTitle} on ${due.when}.`
      : `You're scheduled for ${due.positionTitle} at ${due.eventTitle} tomorrow, ${due.when}.`;
  const eventUrl = `${origin}/schedule/${due.eventId}`;

  const text = [
    lead,
    "",
    `See the event and everyone else assigned: ${eventUrl}`,
    "",
    `Don't want these reminders? Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  // Deliberately plain, inline-styled HTML: email clients strip <style>
  // blocks and external CSS, so anything the ui.module.css design system
  // does on the web has to be re-stated inline here or not at all.
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;color:#111">
  <p>${escapeHtml(lead)}</p>
  <p><a href="${escapeHtml(eventUrl)}" style="color:#1d4ed8">See the event and everyone else assigned</a></p>
  <p style="font-size:12px;color:#666;margin-top:24px">
    You're getting this because you're on the schedule at SafeCampus.
    <a href="${escapeHtml(unsubscribeUrl)}" style="color:#666">Unsubscribe from shift reminders</a>.
  </p>
</div>`;

  return { subject, text, html };
}

export async function sendShiftReminders(admin: SupabaseClient, origin: string, now: Date = new Date()) {
  const horizon = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

  const { data: positions } = await admin
    .from("event_positions")
    .select(
      "id, title, start_time, events(id, title, organization_id, organizations(id, timezone, sms_enabled, email_enabled))",
    )
    .gte("start_time", now.toISOString())
    .lte("start_time", horizon.toISOString())
    .returns<PositionRow[]>();

  const smsDue: DueReminder[] = [];
  const emailDue: DueReminder[] = [];

  for (const position of positions ?? []) {
    const org = position.events?.organizations;
    if (!org || (!org.sms_enabled && !org.email_enabled)) continue;

    const eventStart = new Date(position.start_time);
    const daysAhead = localDayNumber(eventStart, org.timezone) - localDayNumber(now, org.timezone);
    const window = REMINDER_WINDOWS.find((w) => w.daysAhead === daysAhead);
    if (!window) continue;

    const { data: assignments } = await admin
      .from("assignments")
      .select("id, event_position_id, status, members(id, user_id, phone, sms_opt_in, email, email_opt_in)")
      .eq("event_position_id", position.id)
      .neq("status", "declined")
      .returns<AssignmentRow[]>();

    for (const assignment of assignments ?? []) {
      const member = assignment.members;
      if (!member) continue;

      const due: DueReminder = {
        assignmentId: assignment.id,
        memberId: member.id,
        organizationId: position.events!.organization_id,
        template: window.template,
        daysAhead: window.daysAhead,
        eventId: position.events!.id,
        eventTitle: position.events!.title,
        positionTitle: position.title,
        when: formatLocalDateTime(eventStart, org.timezone),
        phone: member.phone,
        email: member.email,
      };

      if (org.sms_enabled && member.sms_opt_in && member.phone) {
        smsDue.push(due);
      }
      // user_id is the "has actually joined" test. A member can be added to
      // the roster and scheduled before they ever accept an invite (see
      // /api/team/invite's sendInvite flag), and email_opt_in defaults to
      // true — without this check, pre-scheduling someone would start
      // mailing an address whose owner never signed up for anything. Their
      // invite is the only mail they get until they join.
      if (org.email_enabled && member.email_opt_in && member.email && member.user_id) {
        emailDue.push(due);
      }
    }
  }

  const checked = positions?.length ?? 0;
  if (smsDue.length === 0 && emailDue.length === 0) {
    return { checked, smsSent: 0, emailSent: 0 };
  }

  // Dedup: skip any (assignment, template) pair already logged on this
  // channel, so a member doesn't get the same reminder twice if the cron
  // reruns or overlaps. The two channels dedup separately — the log rows
  // differ by `channel`, so an email going out doesn't suppress the text.
  async function alreadySentKeys(channel: string, due: DueReminder[]): Promise<Set<string>> {
    if (due.length === 0) return new Set();
    const { data } = await admin
      .from("notifications")
      .select("related_id, template")
      .eq("channel", channel)
      .in("template", TEMPLATES)
      .in(
        "related_id",
        due.map((d) => d.assignmentId),
      );
    return new Set((data ?? []).map((n) => `${n.related_id}:${n.template}`));
  }

  const [smsSentKeys, emailSentKeys] = await Promise.all([
    alreadySentKeys("sms", smsDue),
    alreadySentKeys("email", emailDue),
  ]);

  async function log(due: DueReminder, channel: string, recipient: string, ok: boolean) {
    await admin.from("notifications").insert({
      organization_id: due.organizationId,
      member_id: due.memberId,
      channel,
      recipient,
      template: due.template,
      related_id: due.assignmentId,
      status: ok ? "sent" : "failed",
      sent_at: ok ? new Date().toISOString() : null,
    });
  }

  let smsSent = 0;
  for (const due of smsDue) {
    if (smsSentKeys.has(`${due.assignmentId}:${due.template}`)) continue;

    const result = await sendSms(due.phone!, smsBody(due));
    await log(due, "sms", due.phone!, result.ok);
    if (result.ok) smsSent += 1;
    await sleep(SEND_INTERVAL_MS);
  }

  let emailSent = 0;
  for (const due of emailDue) {
    if (emailSentKeys.has(`${due.assignmentId}:${due.template}`)) continue;

    const unsubscribe = unsubscribeUrlFor(origin, due.memberId);
    const { subject, text, html } = buildReminderEmail(due, origin, unsubscribe.url);
    const result = await sendEmail({
      to: due.email!,
      subject,
      text,
      html,
      unsubscribeUrl: unsubscribe.oneClick ? unsubscribe.url : null,
    });
    await log(due, "email", due.email!, result.ok);
    if (result.ok) emailSent += 1;
  }

  return { checked, smsSent, emailSent };
}
