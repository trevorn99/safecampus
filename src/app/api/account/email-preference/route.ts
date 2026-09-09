import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailOptIn } = await request.json();

  const { data: member } = await supabase.from("members").select("id, email").eq("user_id", user.id).maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (emailOptIn && !member.email) {
    return NextResponse.json({ error: "Your member record has no email address on file" }, { status: 400 });
  }

  // No address field and no confirmation send, unlike the SMS preference
  // route: the address is the one their invite went to and the one their
  // sign-in links use, and mailing someone to confirm they want mail is
  // noise. RLS's "update own profile or admin" covers this write.
  const { error } = await supabase
    .from("members")
    .update({
      email_opt_in: Boolean(emailOptIn),
      email_opt_in_at: emailOptIn ? new Date().toISOString() : null,
    })
    .eq("id", member.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
