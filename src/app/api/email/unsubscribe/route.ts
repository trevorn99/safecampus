import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/email";

// Email's answer to replying STOP (see /api/sms/webhook). No app-level auth
// and no Supabase session: the whole point is that it works from a mail
// client, so the HMAC in `token` is what stands in for one — it proves the
// caller was sent this exact member's reminder mail.
async function unsubscribe(request: Request): Promise<{ ok: boolean }> {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("member") ?? "";
  const token = searchParams.get("token") ?? "";

  if (!memberId || !verifyUnsubscribeToken(memberId, token)) {
    return { ok: false };
  }

  // Service-role: an unsubscribing member has no session here, so RLS's
  // "update own profile or admin" policy has no auth.uid() to match on.
  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ email_opt_in: false, email_opt_in_at: null })
    .eq("id", memberId);

  return { ok: !error };
}

// Clicking the footer link in a reminder.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const { ok } = await unsubscribe(request);
  return NextResponse.redirect(`${origin}/unsubscribed${ok ? "" : "?error=1"}`);
}

// Gmail/Outlook's native one-click Unsubscribe button (RFC 8058) POSTs the
// same URL instead of opening it. The body is `List-Unsubscribe=One-Click`
// and goes unread — the query string already identifies the member.
export async function POST(request: Request) {
  const { ok } = await unsubscribe(request);
  return ok
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
}
