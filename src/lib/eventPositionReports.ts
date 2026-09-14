import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, renderBrandedEmail, sendEmail, unsubscribeUrlFor } from "@/lib/email";
import { localDayNumber, formatLocalDateTime } from "@/lib/localDay";

export const POSITION_REPORT_TEMPLATE = "event_position_report";

// Three days out, matching the first shift reminder. That's the point of the
// report: the same morning the team is told they're on, the admins are told
// what's still uncovered — early enough to do something about a gap, late
// enough that people have had a chance to sign up.
const REPORT_DAYS_AHEAD = 3;

type PositionRow = {
  id: string;
  title: string;
  slots: number;
  start_time: string;
  team_id: string | null;
};

type EventRow = {
  id: string;
  title: string;
  start_time: string;
  organization_id: string;
  location_id: string | null;
  organizations: { id: string; name: string; timezone: string; email_enabled: boolean } | null;
  locations: { name: string } | null;
};

function positionRowsHtml(
  positions: PositionRow[],
  namesByPosition: Map<string, string[]>,
  timeZone: string,
): string {
  return positions
    .map((position) => {
      const names = namesByPosition.get(position.id) ?? [];
      const short = names.length < position.slots;
      return `<tr>
        <td style="padding:8px 10px;border-top:1px solid #dfe4df;font-size:13px;color:#1c2430">
          <strong>${escapeHtml(position.title)}</strong><br />
          <span style="color:#5b6670">${escapeHtml(formatLocalDateTime(new Date(position.start_time), timeZone))}</span>
        </td>
        <td style="padding:8px 10px;border-top:1px solid #dfe4df;font-size:13px;color:${short ? "#a4432f" : "#1c2430"};white-space:nowrap">
          ${names.length} of ${position.slots}${short ? " — short" : ""}
        </td>
        <td style="padding:8px 10px;border-top:1px solid #dfe4df;font-size:13px;color:#1c2430">
          ${names.length > 0 ? escapeHtml(names.join(", ")) : `<span style='color:#a4432f'>Nobody assigned</span>`}
        </td>
      </tr>`;
    })
    .join("");
}

export async function sendEventPositionReports(
  admin: SupabaseClient,
  origin: string,
  now: Date = new Date(),
) {
  // Four days covers the target date in every timezone; the day-number
  // comparison below is what actually picks it out.
  const horizon = new Date(now.getTime() + (REPORT_DAYS_AHEAD + 1) * 24 * 60 * 60 * 1000);

  const { data: events } = await admin
    .from("events")
    .select(
      "id, title, start_time, organization_id, location_id, organizations(id, name, timezone, email_enabled), locations(name)",
    )
    .gte("start_time", now.toISOString())
    .lte("start_time", horizon.toISOString())
    .returns<EventRow[]>();

  let sent = 0;
  for (const event of events ?? []) {
    const org = event.organizations;
    if (!org || !org.email_enabled) continue;

    const eventStart = new Date(event.start_time);
    if (localDayNumber(eventStart, org.timezone) - localDayNumber(now, org.timezone) !== REPORT_DAYS_AHEAD) {
      continue;
    }

    const { data: positions } = await admin
      .from("event_positions")
      .select("id, title, slots, start_time, team_id")
      .eq("event_id", event.id)
      .order("start_time")
      .returns<PositionRow[]>();

    // An event with no positions has nothing to report on.
    if (!positions || positions.length === 0) continue;

    const { data: assignments } = await admin
      .from("assignments")
      .select("event_position_id, status, members(name)")
      .in(
        "event_position_id",
        positions.map((position) => position.id),
      )
      // Declined assignments don't hold a slot anywhere else in the app, so
      // counting them here would report a position as covered when it isn't.
      .neq("status", "declined")
      .returns<{ event_position_id: string; status: string; members: { name: string } | null }[]>();

    const namesByPosition = new Map<string, string[]>();
    for (const assignment of assignments ?? []) {
      const list = namesByPosition.get(assignment.event_position_id) ?? [];
      list.push(assignment.members?.name ?? "Unknown member");
      namesByPosition.set(assignment.event_position_id, list);
    }

    const totalSlots = positions.reduce((sum, position) => sum + position.slots, 0);
    const totalFilled = positions.reduce(
      (sum, position) => sum + Math.min((namesByPosition.get(position.id) ?? []).length, position.slots),
      0,
    );
    const shortCount = positions.filter(
      (position) => (namesByPosition.get(position.id) ?? []).length < position.slots,
    ).length;

    // Org admins of this organization, who have joined and still want
    // schedule email. This is an operational report rather than a personal
    // reminder, but it goes out over the same channel and honours the same
    // unsubscribe — an admin who turned schedule email off meant it.
    const { data: adminRoles } = await admin
      .from("role_assignments")
      .select("member_id")
      .eq("scope_type", "org")
      .eq("role", "org_admin")
      .eq("scope_id", event.organization_id);

    const adminMemberIds = [...new Set((adminRoles ?? []).map((row) => row.member_id))];
    if (adminMemberIds.length === 0) continue;

    const { data: recipients } = await admin
      .from("members")
      .select("id, email")
      .in("id", adminMemberIds)
      .eq("status", "active")
      .eq("email_opt_in", true)
      .not("email", "is", null)
      .not("user_id", "is", null);

    const { data: alreadySent } = await admin
      .from("notifications")
      .select("member_id")
      .eq("channel", "email")
      .eq("template", POSITION_REPORT_TEMPLATE)
      .eq("related_id", event.id);
    const told = new Set((alreadySent ?? []).map((row) => row.member_id));

    const when = formatLocalDateTime(eventStart, org.timezone);
    const eventUrl = `${origin}/schedule/${event.id}`;
    const summary =
      shortCount === 0
        ? `All ${totalSlots} slots are covered.`
        : `${totalFilled} of ${totalSlots} slots covered — ${shortCount} ${shortCount === 1 ? "position is" : "positions are"} short.`;

    for (const recipient of recipients ?? []) {
      if (told.has(recipient.id) || !recipient.email) continue;

      const unsubscribe = unsubscribeUrlFor(origin, recipient.id);
      const html = renderBrandedEmail({
        origin,
        eyebrow: org.name,
        bodyHtml: `<p style="margin:0 0 6px;font-size:16px;line-height:1.5;color:#1c2430">
              <strong>${escapeHtml(event.title)}</strong> is in ${REPORT_DAYS_AHEAD} days.
            </p>
            <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#5b6670">
              ${escapeHtml(when)} · ${escapeHtml(event.locations?.name ?? "Organization-wide")}<br />${escapeHtml(summary)}
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dfe4df;border-radius:8px;border-collapse:separate;margin-bottom:22px">
              <tr>
                <th align="left" style="padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#5b6670">Position</th>
                <th align="left" style="padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#5b6670">Filled</th>
                <th align="left" style="padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#5b6670">Who</th>
              </tr>
              ${positionRowsHtml(positions, namesByPosition, org.timezone)}
            </table>`,
        cta: { label: "Open the event", url: eventUrl },
        footerHtml: `You&rsquo;re getting this because you&rsquo;re an org admin at ${escapeHtml(org.name)}.
            <a href="${escapeHtml(unsubscribe.url)}" style="color:#5b6670;text-decoration:underline">Unsubscribe from schedule emails</a>.`,
      });

      const text = [
        org.name,
        "",
        `${event.title} is in ${REPORT_DAYS_AHEAD} days.`,
        `${when} · ${event.locations?.name ?? "Organization-wide"}`,
        summary,
        "",
        ...positions.map((position) => {
          const names = namesByPosition.get(position.id) ?? [];
          return `- ${position.title} (${formatLocalDateTime(new Date(position.start_time), org.timezone)}): ${names.length} of ${position.slots}${
            names.length > 0 ? ` — ${names.join(", ")}` : " — nobody assigned"
          }`;
        }),
        "",
        `Open the event: ${eventUrl}`,
        "",
        `Unsubscribe from schedule emails: ${unsubscribe.url}`,
      ].join("\n");

      const result = await sendEmail({
        to: recipient.email,
        subject:
          shortCount === 0
            ? `${event.title} in ${REPORT_DAYS_AHEAD} days — fully covered`
            : `${event.title} in ${REPORT_DAYS_AHEAD} days — ${shortCount} position${shortCount === 1 ? "" : "s"} short`,
        text,
        html,
        unsubscribeUrl: unsubscribe.oneClick ? unsubscribe.url : null,
      });

      await admin.from("notifications").insert({
        organization_id: event.organization_id,
        member_id: recipient.id,
        channel: "email",
        recipient: recipient.email,
        template: POSITION_REPORT_TEMPLATE,
        related_id: event.id,
        status: result.ok ? "sent" : "failed",
        sent_at: result.ok ? new Date().toISOString() : null,
      });
      if (result.ok) sent += 1;
    }
  }

  return { reportsSent: sent };
}
