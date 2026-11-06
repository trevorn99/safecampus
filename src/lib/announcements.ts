import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, renderBrandedEmail, sendEmail } from "@/lib/email";
import { sendSms, toE164 } from "@/lib/sms";

// Announcements: a message to the organization, chosen teams, or the team
// leads.
//
// Who may send to whom:
//   - org admins: anyone — the whole organization, any teams, team leads;
//   - location managers: teams at a location they manage;
//   - team leads: the teams they lead, and no others.
// Members can't send.
//
// Delivery deliberately ignores reminder settings for email: announcements
// are rare, and "service moved to 10:30" has to reach people who turned
// schedule emails off. Texts still go only to people who opted in to them,
// and only if the organization hasn't switched texting off — consent for
// SMS is a legal matter, not a preference.

export type Audience = "organization" | "teams" | "team_leads";
export type Team = { id: string; name: string };

export type SenderScope = {
  isOrgAdmin: boolean;
  /** Every team this sender may address. Empty means they can't send. */
  allowedTeams: Team[];
};

export async function senderScope(
  supabase: SupabaseClient,
  memberId: string,
  organizationId: string,
): Promise<SenderScope> {
  const [{ data: isAdmin }, { data: teams }, { data: roles }] = await Promise.all([
    supabase.rpc("is_org_admin", { target_org: organizationId }),
    supabase.from("teams").select("id, name, location_id").eq("organization_id", organizationId).order("name"),
    supabase.from("role_assignments").select("role, scope_type, scope_id").eq("member_id", memberId),
  ]);

  const all = (teams ?? []) as (Team & { location_id: string | null })[];
  if (isAdmin) return { isOrgAdmin: true, allowedTeams: all.map(({ id, name }) => ({ id, name })) };

  const ledTeams = new Set(
    (roles ?? []).filter((r) => r.role === "team_lead" && r.scope_type === "team").map((r) => r.scope_id),
  );
  const managedLocations = new Set(
    (roles ?? []).filter((r) => r.role === "location_manager" && r.scope_type === "location").map((r) => r.scope_id),
  );
  return {
    isOrgAdmin: false,
    allowedTeams: all
      .filter((team) => ledTeams.has(team.id) || (team.location_id !== null && managedLocations.has(team.location_id)))
      .map(({ id, name }) => ({ id, name })),
  };
}

export type Recipient = { id: string; email: string | null; phone: string | null; smsOptIn: boolean };

/**
 * The members an announcement reaches. Only members who have joined:
 * someone still "pending" either has no account or hasn't accepted their
 * invitation, and their first email from SafeCampus shouldn't be a
 * broadcast.
 */
export async function resolveRecipients(
  admin: SupabaseClient,
  organizationId: string,
  audience: Audience,
  teamIds: string[],
): Promise<Recipient[]> {
  let memberIds: Set<string> | null = null;

  if (audience !== "organization") {
    let query = admin.from("role_assignments").select("member_id").eq("scope_type", "team");
    query = audience === "teams" ? query.in("scope_id", teamIds) : query.eq("role", "team_lead");
    const { data: rows } = await query;
    memberIds = new Set((rows ?? []).map((row) => row.member_id));
    if (memberIds.size === 0) return [];
  }

  const { data: members } = await admin
    .from("members")
    .select("id, email, phone, sms_opt_in")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  return (members ?? [])
    .filter((m) => memberIds === null || memberIds.has(m.id))
    .map((m) => ({ id: m.id, email: m.email, phone: m.phone, smsOptIn: Boolean(m.sms_opt_in) }));
}

export function textableRecipients(recipients: Recipient[], smsEnabled: boolean): Recipient[] {
  if (!smsEnabled) return [];
  return recipients.filter((r) => r.smsOptIn && r.phone && toE164(r.phone));
}

function buildEmail({
  origin,
  orgName,
  senderName,
  subject,
  body,
  audienceLabel,
}: {
  origin: string;
  orgName: string;
  senderName: string;
  subject: string;
  body: string;
  audienceLabel: string;
}) {
  const bodyHtml = escapeHtml(body)
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1c2430">${paragraph.replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
  const footer = `Sent by ${senderName} to ${audienceLabel} at ${orgName}, through SafeCampus. Announcements reach everyone they're addressed to, whatever their reminder settings. Reply to this email to answer ${senderName} directly.`;
  return {
    subject: `${orgName}: ${subject}`,
    text: [subject, "", body, "", "—", footer, "", `View in SafeCampus: ${origin}/announcements`].join("\n"),
    html: renderBrandedEmail({
      origin,
      eyebrow: orgName,
      bodyHtml: `<p style="margin:0 0 6px;font-size:17px;font-weight:700;line-height:1.4;color:#1c2430">${escapeHtml(subject)}</p>
            <p style="margin:0 0 18px;font-size:13px;color:#5b6670">From ${escapeHtml(senderName)} · to ${escapeHtml(audienceLabel)}</p>
            ${bodyHtml}`,
      cta: { label: "Open in SafeCampus", url: `${origin}/announcements` },
      footerHtml: escapeHtml(footer),
    }),
  };
}

function smsText(orgName: string, subject: string, body: string, origin: string): string {
  const head = `${orgName}: ${subject}. `;
  const tail = ` More: ${origin.replace(/^https?:\/\//, "")}/announcements Reply STOP to opt out.`;
  const room = 300 - head.length - tail.length;
  const snippet = body.replace(/\s+/g, " ").trim();
  return head + (snippet.length > room ? `${snippet.slice(0, Math.max(0, room - 1))}…` : snippet) + tail;
}

/** Runs tasks a few at a time: fast for a 50-person team, gentle on SendGrid. */
async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<boolean>): Promise<number> {
  let succeeded = 0;
  for (let i = 0; i < items.length; i += size) {
    const results = await Promise.all(items.slice(i, i + size).map(run));
    succeeded += results.filter(Boolean).length;
  }
  return succeeded;
}

export async function deliverAnnouncement({
  admin,
  announcementId,
  recipients,
  sendText,
  smsEnabled,
  origin,
  orgName,
  senderName,
  senderEmail,
  subject,
  body,
  audienceLabel,
}: {
  admin: SupabaseClient;
  announcementId: string;
  recipients: Recipient[];
  sendText: boolean;
  smsEnabled: boolean;
  origin: string;
  orgName: string;
  senderName: string;
  senderEmail: string | null;
  subject: string;
  body: string;
  audienceLabel: string;
}): Promise<{ emailCount: number; smsCount: number }> {
  const email = buildEmail({ origin, orgName, senderName, subject, body, audienceLabel });
  const emailCount = await inBatches(
    recipients.filter((r) => r.email),
    5,
    async (r) =>
      (
        await sendEmail({
          to: r.email!,
          ...email,
          fromName: `${senderName} via SafeCampus`,
          replyTo: senderEmail ? { email: senderEmail, name: senderName } : null,
        })
      ).ok,
  );

  const text = smsText(orgName, subject, body, origin);
  const smsCount = sendText
    ? await inBatches(textableRecipients(recipients, smsEnabled), 5, async (r) => (await sendSms(toE164(r.phone!)!, text)).ok)
    : 0;

  await admin.from("announcements").update({ email_count: emailCount, sms_count: smsCount }).eq("id", announcementId);
  return { emailCount, smsCount };
}
