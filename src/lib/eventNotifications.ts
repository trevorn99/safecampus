import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, renderBrandedEmail, sendEmail, unsubscribeUrlFor } from "@/lib/email";
import { formatEventTimeRange } from "@/lib/formatDateTime";

export const EVENT_ANNOUNCED_TEMPLATE = "event_announced";

type Recipient = { id: string; name: string; email: string };

// Who hears about a new event. Scoped to the teams the event actually asks
// for where it has any — telling the whole organization about a medical
// team's drill is how people learn to ignore these — and to everyone
// otherwise, which is what an event with no team-scoped positions means.
async function recipientsFor(
  admin: SupabaseClient,
  organizationId: string,
  eventId: string,
): Promise<Recipient[]> {
  const { data: positions } = await admin
    .from("event_positions")
    .select("team_id")
    .eq("event_id", eventId);

  const teamIds = [...new Set((positions ?? []).map((p) => p.team_id).filter((id): id is string => Boolean(id)))];

  let memberIds: string[] | null = null;
  if (teamIds.length > 0) {
    const { data: roles } = await admin
      .from("role_assignments")
      .select("member_id")
      .eq("scope_type", "team")
      .in("scope_id", teamIds);
    memberIds = [...new Set((roles ?? []).map((row) => row.member_id))];
    if (memberIds.length === 0) return [];
  }

  // email_opt_in is the same switch that governs shift reminders, and
  // deliberately so: it means "SafeCampus may email me about the schedule",
  // and a new event on it is exactly that. user_id filters to people who have
  // actually joined — the same reason reminders skip un-joined roster
  // entries, since nobody has confirmed that address is theirs.
  let query = admin
    .from("members")
    .select("id, name, email")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("email_opt_in", true)
    .not("email", "is", null)
    .not("user_id", "is", null);
  if (memberIds) query = query.in("id", memberIds);

  const { data: members } = await query;
  return (members ?? []).filter((m): m is Recipient => Boolean(m.email));
}

export async function notifyEventCreated(
  admin: SupabaseClient,
  organizationId: string,
  eventId: string,
  origin: string,
): Promise<{ sent: number; skipped: number }> {
  const { data: event } = await admin
    .from("events")
    .select("id, title, start_time, end_time, type, location_id, organization_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.organization_id !== organizationId) return { sent: 0, skipped: 0 };

  const [{ data: org }, { data: location }] = await Promise.all([
    admin.from("organizations").select("name, timezone, email_enabled").eq("id", organizationId).maybeSingle(),
    event.location_id
      ? admin.from("locations").select("name, timezone").eq("id", event.location_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // The org-wide master switch governs this as much as it governs reminders.
  if (!org?.email_enabled) return { sent: 0, skipped: 0 };

  const timeZone = location?.timezone || org.timezone;
  const when = formatEventTimeRange(event.start_time, event.end_time, timeZone);
  const eventUrl = `${origin}/schedule/${event.id}`;
  const recipients = await recipientsFor(admin, organizationId, eventId);

  // Already told, from an earlier press of the same button.
  const { data: alreadySent } = await admin
    .from("notifications")
    .select("member_id")
    .eq("channel", "email")
    .eq("template", EVENT_ANNOUNCED_TEMPLATE)
    .eq("related_id", eventId);
  const told = new Set((alreadySent ?? []).map((row) => row.member_id));

  let sent = 0;
  let skipped = 0;
  for (const recipient of recipients) {
    if (told.has(recipient.id)) {
      skipped += 1;
      continue;
    }

    const unsubscribe = unsubscribeUrlFor(origin, recipient.id);
    const html = renderBrandedEmail({
      origin,
      eyebrow: org.name,
      bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.5;color:#1c2430">A new event has been added to the schedule.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f4;border-radius:8px;margin-bottom:22px">
              <tr><td style="padding:14px 16px;font-size:14px;line-height:1.7;color:#1c2430">
                <strong style="color:#5b6670;font-weight:600">Event</strong>&nbsp;&nbsp;${escapeHtml(event.title)}<br />
                <strong style="color:#5b6670;font-weight:600">When</strong>&nbsp;&nbsp;${escapeHtml(when)}<br />
                <strong style="color:#5b6670;font-weight:600">Where</strong>&nbsp;&nbsp;${escapeHtml(location?.name ?? "Organization-wide")}
              </td></tr>
            </table>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#5b6670">Open it to see which positions still need covering, and sign up for one.</p>`,
      cta: { label: "See the event", url: eventUrl },
      footerHtml: `You&rsquo;re getting this because you&rsquo;re on the schedule at ${escapeHtml(org.name)}.
            <a href="${escapeHtml(unsubscribe.url)}" style="color:#5b6670;text-decoration:underline">Unsubscribe from schedule emails</a>.`,
    });

    const result = await sendEmail({
      to: recipient.email,
      subject: `New event: ${event.title} — ${when}`,
      text: [
        org.name,
        "",
        "A new event has been added to the schedule.",
        "",
        `Event: ${event.title}`,
        `When: ${when}`,
        `Where: ${location?.name ?? "Organization-wide"}`,
        "",
        `See it and sign up for a position: ${eventUrl}`,
        "",
        `Unsubscribe from schedule emails: ${unsubscribe.url}`,
      ].join("\n"),
      html,
      unsubscribeUrl: unsubscribe.oneClick ? unsubscribe.url : null,
    });

    await admin.from("notifications").insert({
      organization_id: organizationId,
      member_id: recipient.id,
      channel: "email",
      recipient: recipient.email,
      template: EVENT_ANNOUNCED_TEMPLATE,
      related_id: eventId,
      status: result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
    });
    if (result.ok) sent += 1;
  }

  return { sent, skipped };
}
