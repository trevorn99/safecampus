import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { utcToZonedWallTime } from "@/lib/timezone";
import { sendSms } from "@/lib/sms";

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

type PositionRow = {
  id: string;
  title: string;
  start_time: string;
  events: {
    id: string;
    title: string;
    organization_id: string;
    organizations: { id: string; timezone: string; sms_enabled: boolean } | null;
  } | null;
};

type AssignmentRow = {
  id: string;
  event_position_id: string;
  status: string;
  members: { id: string; phone: string | null; sms_opt_in: boolean } | null;
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

export async function sendShiftReminders(admin: SupabaseClient, now: Date = new Date()) {
  const horizon = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

  const { data: positions } = await admin
    .from("event_positions")
    .select("id, title, start_time, events(id, title, organization_id, organizations(id, timezone, sms_enabled))")
    .gte("start_time", now.toISOString())
    .lte("start_time", horizon.toISOString())
    .returns<PositionRow[]>();

  const dueAssignments: {
    assignmentId: string;
    memberId: string;
    phone: string;
    template: string;
    body: string;
    organizationId: string;
  }[] = [];

  for (const position of positions ?? []) {
    const org = position.events?.organizations;
    if (!org || !org.sms_enabled) continue;

    const eventStart = new Date(position.start_time);
    const daysAhead = localDayNumber(eventStart, org.timezone) - localDayNumber(now, org.timezone);
    const window = REMINDER_WINDOWS.find((w) => w.daysAhead === daysAhead);
    if (!window) continue;

    const { data: assignments } = await admin
      .from("assignments")
      .select("id, event_position_id, status, members(id, phone, sms_opt_in)")
      .eq("event_position_id", position.id)
      .neq("status", "declined")
      .returns<AssignmentRow[]>();

    for (const assignment of assignments ?? []) {
      const member = assignment.members;
      if (!member || !member.sms_opt_in || !member.phone) continue;

      const when = formatLocalDateTime(eventStart, org.timezone);
      const body =
        window.daysAhead === 3
          ? `SafeCampus reminder: you're on ${position.title} for ${position.events?.title} on ${when}. Reply STOP to opt out.`
          : `SafeCampus reminder: you're on ${position.title} for ${position.events?.title} tomorrow, ${when}. Reply STOP to opt out.`;

      dueAssignments.push({
        assignmentId: assignment.id,
        memberId: member.id,
        phone: member.phone,
        template: window.template,
        body,
        organizationId: position.events!.organization_id,
      });
    }
  }

  if (dueAssignments.length === 0) {
    return { checked: positions?.length ?? 0, sent: 0 };
  }

  // Dedup: skip any (assignment, template) pair already logged, so a member
  // doesn't get the same reminder twice if the cron reruns or overlaps.
  const { data: alreadySent } = await admin
    .from("notifications")
    .select("related_id, template")
    .eq("channel", "sms")
    .in(
      "template",
      REMINDER_WINDOWS.map((w) => w.template),
    )
    .in(
      "related_id",
      dueAssignments.map((a) => a.assignmentId),
    );
  const sentKeys = new Set((alreadySent ?? []).map((n) => `${n.related_id}:${n.template}`));

  let sent = 0;
  for (const due of dueAssignments) {
    if (sentKeys.has(`${due.assignmentId}:${due.template}`)) continue;

    const result = await sendSms(due.phone, due.body);
    await admin.from("notifications").insert({
      organization_id: due.organizationId,
      member_id: due.memberId,
      channel: "sms",
      recipient: due.phone,
      template: due.template,
      related_id: due.assignmentId,
      status: result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
    });
    if (result.ok) sent += 1;
  }

  return { checked: positions?.length ?? 0, sent };
}
