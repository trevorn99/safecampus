import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicOrigin } from "@/lib/siteUrl";
import {
  deliverAnnouncement,
  resolveRecipients,
  senderScope,
  textableRecipients,
  type Audience,
} from "@/lib/announcements";

// Sending to a full organization sends an email per member, five at a time.
export const maxDuration = 60;

const MAX_PER_HOUR = 10;
const AUDIENCES: Audience[] = ["organization", "teams", "team_leads"];

// Sends an announcement, or with `preview: true` only counts who it would
// reach — the compose form shows that number before anything is sent.
// Every permission is checked here, not just in the form.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: member } = await supabase
    .from("members")
    .select("id, name, email, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No organization" }, { status: 403 });

  let input: { subject?: unknown; body?: unknown; audience?: unknown; teamIds?: unknown; sendText?: unknown; preview?: unknown } =
    {};
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const audience = AUDIENCES.includes(input.audience as Audience) ? (input.audience as Audience) : null;
  if (!audience) return NextResponse.json({ error: "Choose who to send it to." }, { status: 400 });
  const teamIds = Array.isArray(input.teamIds) ? input.teamIds.filter((id): id is string => typeof id === "string") : [];

  const scope = await senderScope(supabase, member.id, member.organization_id);
  if (!scope.isOrgAdmin && scope.allowedTeams.length === 0) {
    return NextResponse.json(
      { error: "Only org admins, location managers and team leads can send announcements." },
      { status: 403 },
    );
  }
  // Everyone and team leads are organization-wide audiences, so org admins
  // only. Anyone else may address only teams within their own scope.
  if (audience !== "teams" && !scope.isOrgAdmin) {
    return NextResponse.json({ error: "Only org admins can send to everyone or to all team leads." }, { status: 403 });
  }
  const allowed = new Map(scope.allowedTeams.map((team) => [team.id, team.name]));
  if (audience === "teams") {
    if (teamIds.length === 0) return NextResponse.json({ error: "Choose at least one team." }, { status: 400 });
    if (teamIds.some((id) => !allowed.has(id))) {
      return NextResponse.json({ error: "You can only send to teams you lead or manage." }, { status: 403 });
    }
  }

  const audienceLabel =
    audience === "organization"
      ? "everyone"
      : audience === "team_leads"
        ? "the team leads"
        : teamIds.map((id) => allowed.get(id)).join(", ");

  const admin = createAdminClient();
  const [recipients, { data: org }] = await Promise.all([
    resolveRecipients(admin, member.organization_id, audience, teamIds),
    admin.from("organizations").select("name, sms_enabled").eq("id", member.organization_id).single(),
  ]);
  const smsEnabled = Boolean(org?.sms_enabled);
  const texts = textableRecipients(recipients, smsEnabled).length;

  if (input.preview === true) {
    return NextResponse.json({
      recipients: recipients.length,
      emails: recipients.filter((r) => r.email).length,
      texts,
      smsEnabled,
    });
  }

  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!subject || subject.length > 150) {
    return NextResponse.json({ error: "Give it a subject of up to 150 characters." }, { status: 400 });
  }
  if (!body || body.length > 5000) {
    return NextResponse.json({ error: "Write a message of up to 5,000 characters." }, { status: 400 });
  }
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "Nobody would receive this — no one in that group has joined SafeCampus yet." },
      { status: 400 },
    );
  }

  // Every announcement is an email per member from our domain. A stuck
  // button or a mistaken loop shouldn't be able to send dozens.
  const { count } = await admin
    .from("announcements")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", member.organization_id)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if ((count ?? 0) >= MAX_PER_HOUR) {
    return NextResponse.json(
      { error: "Your organization has sent the maximum announcements for this hour. Try again later." },
      { status: 429 },
    );
  }

  const sendText = input.sendText === true && smsEnabled;
  const { data: created, error: insertError } = await admin
    .from("announcements")
    .insert({
      organization_id: member.organization_id,
      sender_member_id: member.id,
      sender_name: member.name,
      subject,
      body,
      audience,
      audience_label: audienceLabel,
      team_ids: audience === "teams" ? teamIds : [],
      sent_sms: sendText,
      recipient_count: recipients.length,
    })
    .select("id")
    .single();
  if (insertError || !created) {
    return NextResponse.json({ error: insertError?.message ?? "Couldn't save the announcement." }, { status: 400 });
  }

  const { error: recipientsError } = await admin.from("announcement_recipients").insert(
    recipients.map((r) => ({ announcement_id: created.id, member_id: r.id, organization_id: member.organization_id })),
  );
  if (recipientsError) console.error("announcement recipients not recorded", recipientsError.message);

  const delivered = await deliverAnnouncement({
    admin,
    announcementId: created.id,
    recipients,
    sendText,
    smsEnabled,
    origin: publicOrigin(new URL(request.url).origin),
    orgName: org?.name ?? "Your organization",
    senderName: member.name,
    senderEmail: member.email ?? user.email ?? null,
    subject,
    body,
    audienceLabel,
  });

  return NextResponse.json({ ok: true, recipients: recipients.length, ...delivered });
}
