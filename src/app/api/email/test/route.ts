import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, unsubscribeUrlFor } from "@/lib/email";
import { buildReminderEmail, type DueReminder } from "@/lib/shiftReminders";

// Sends one real shift-reminder email, built from the real template, to the
// signed-in platform admin's own address. Exists because reminders otherwise
// only leave the building via the daily cron, and only for someone assigned
// to a position exactly 3 or 1 days out — so there was no way to check that
// SENDGRID_API_KEY, the verified sender, the unsubscribe link, or inbox
// placement actually work until a real member was owed a real reminder.
//
// POST rather than GET so a stray prefetch or a crawler can't fire it.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (!isPlatformAdmin) {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  // Deliberately always the caller's own address — no `to` from the request
  // body. A signed-in endpoint that mails arbitrary recipients is a spam
  // relay, and this one is reachable by anyone holding a platform-admin
  // session. Testing a different inbox means signing in as that address.
  const recipient = user.email;
  if (!recipient) {
    return NextResponse.json({ error: "Your account has no email address" }, { status: 400 });
  }

  // The unsubscribe link is generated against the caller's own member row,
  // so it's a genuinely working link — clicking it really does turn their
  // reminders off. That's the point (an untested unsubscribe link is how you
  // find out it's broken from a spam complaint), and it's reversible from
  // the account page.
  const { data: member } = await supabase
    .from("members")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Real org name where the caller has one, so the test also proves the
  // header renders a genuine name rather than a placeholder of known length.
  const { data: org } = member
    ? await supabase.from("organizations").select("name").eq("id", member.organization_id).maybeSingle()
    : { data: null };
  const unsubscribe = unsubscribeUrlFor(new URL(request.url).origin, member?.id ?? user.id);

  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const due: DueReminder = {
    assignmentId: "sample",
    memberId: member?.id ?? user.id,
    organizationId: "sample",
    orgName: org?.name ?? "Sample Organization",
    template: "shift_reminder_24_hour",
    daysAhead: 1,
    eventId: "sample",
    // Named so the email reads unmistakably as a test in an inbox, while the
    // template, subject line and markup stay exactly what a real reminder
    // sends — which is the thing under test.
    eventTitle: "Sample Event (test)",
    positionTitle: "Sample Position",
    when: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(start),
    phone: null,
    email: recipient,
  };

  const origin = new URL(request.url).origin;
  const { subject, text, html } = buildReminderEmail(due, origin, unsubscribe.url);
  const result = await sendEmail({
    to: recipient,
    subject,
    text,
    html,
    unsubscribeUrl: unsubscribe.oneClick ? unsubscribe.url : null,
  });

  // Not logged to notifications: that table is the reminder ledger the cron
  // dedups against, and a test send is neither owed to anyone nor something
  // a future run should skip.
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "SendGrid rejected the message" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    sentTo: recipient,
    oneClickUnsubscribe: unsubscribe.oneClick,
  });
}
