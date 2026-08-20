import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms, toE164 } from "@/lib/sms";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone, smsOptIn } = await request.json();
  const trimmedPhone = typeof phone === "string" ? phone.trim() : "";

  if (smsOptIn && !trimmedPhone) {
    return NextResponse.json({ error: "A phone number is required to enable SMS alerts" }, { status: 400 });
  }

  // SignalWire's API rejects anything that isn't E.164 — normalize here so
  // "555-123-4567" or "(555) 123-4567" work the same as "+15551234567",
  // and reject clearly (rather than silently failing to send later) if it
  // doesn't look like a valid 10-digit US/CA number at all.
  const normalizedPhone = trimmedPhone ? toE164(trimmedPhone) : null;
  if (smsOptIn && !normalizedPhone) {
    return NextResponse.json({ error: "Enter a valid 10-digit US phone number" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, organization_id, sms_opt_in")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newlyOptingIn = Boolean(smsOptIn) && !member.sms_opt_in;

  const { error: updateError } = await supabase
    .from("members")
    .update({
      phone: normalizedPhone ?? null,
      sms_opt_in: Boolean(smsOptIn),
      sms_opt_in_at: smsOptIn ? new Date().toISOString() : null,
    })
    .eq("id", member.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (newlyOptingIn && normalizedPhone) {
    const result = await sendSms(
      normalizedPhone,
      "SafeCampus: You're subscribed to shift reminder texts (up to 2/shift). Msg & data rates may apply. Reply HELP for help, STOP to cancel.",
    );
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      organization_id: member.organization_id,
      member_id: member.id,
      channel: "sms",
      recipient: normalizedPhone,
      template: "sms_opt_in_confirmation",
      status: result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: true, warning: "Saved, but the confirmation text couldn't be sent. Try toggling it off and on again." },
        { status: 200 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
