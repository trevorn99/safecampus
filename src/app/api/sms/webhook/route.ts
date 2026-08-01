import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignalWireSignature } from "@/lib/sms";

// Inbound SMS from members replying STOP/START/HELP to our SignalWire
// number. Configure this route's URL (https://<domain>/api/sms/webhook) as
// the messaging webhook on the SignalWire phone number in their dashboard —
// nothing here fires unless SignalWire is pointed at it. No app-level auth;
// the signature check below is what stands in for it, since SignalWire
// calls this directly with no Supabase session.
const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START_KEYWORDS = new Set(["START", "UNSTOP", "YES"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function laml(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(body, { status: 200, headers: { "Content-Type": "text/xml" } });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const signature = request.headers.get("x-signalwire-signature") ?? "";

  if (!verifySignalWireSignature(request.url, params, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const from = params.From;
  const bodyText = (params.Body ?? "").trim().toUpperCase();
  if (!from) {
    return laml();
  }

  const admin = createAdminClient();
  const normalizedFrom = normalizePhone(from);

  // members.phone isn't guaranteed to be stored in E.164 like SignalWire
  // sends `From` — compare on digits-only, last 10, to tolerate formatting
  // differences ("+1 555-123-4567" vs "5551234567" vs "(555) 123-4567").
  async function findMatchingMembers() {
    const { data: members } = await admin.from("members").select("id, phone").not("phone", "is", null);
    return (members ?? []).filter((member) => member.phone && normalizePhone(member.phone) === normalizedFrom);
  }

  if (STOP_KEYWORDS.has(bodyText)) {
    const matches = await findMatchingMembers();
    for (const member of matches) {
      await admin.from("members").update({ sms_opt_in: false, sms_opt_in_at: null }).eq("id", member.id);
    }
    return laml("You have been unsubscribed from SafeCampus SMS reminders. Reply START to resubscribe.");
  }

  if (START_KEYWORDS.has(bodyText)) {
    const matches = await findMatchingMembers();
    for (const member of matches) {
      await admin
        .from("members")
        .update({ sms_opt_in: true, sms_opt_in_at: new Date().toISOString() })
        .eq("id", member.id);
    }
    return laml("You're resubscribed to SafeCampus SMS shift reminders. Reply STOP to unsubscribe.");
  }

  if (HELP_KEYWORDS.has(bodyText)) {
    return laml("SafeCampus shift reminders. Reply STOP to unsubscribe. Help: safecampus.net/support");
  }

  return laml();
}
