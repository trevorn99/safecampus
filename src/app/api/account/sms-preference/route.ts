import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/sms";

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
      phone: trimmedPhone || null,
      sms_opt_in: Boolean(smsOptIn),
      sms_opt_in_at: smsOptIn ? new Date().toISOString() : null,
    })
    .eq("id", member.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (newlyOptingIn) {
    const result = await sendSms(
      trimmedPhone,
      "SafeCampus: You're subscribed to shift reminder texts (up to 2/shift). Msg & data rates may apply. Reply HELP for help, STOP to cancel.",
    );
    // TEMPORARY: diagnosing a report of no text arriving despite a 200
    // response — this route never surfaced sendSms's own error detail
    // anywhere. Remove once confirmed working.
    if (!result.ok) {
      console.error("sms-preference: sendSms failed", result.error);
    }
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      organization_id: member.organization_id,
      member_id: member.id,
      channel: "sms",
      recipient: trimmedPhone,
      template: "sms_opt_in_confirmation",
      status: result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
    });
  }

  return NextResponse.json({ ok: true });
}
