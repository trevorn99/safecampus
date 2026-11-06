import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedInRedirect } from "@/lib/postSignIn";

// Google OAuth and anything else that returns a PKCE code. Email links no
// longer arrive here — they go to /auth/confirm, which verifies the token on
// this domain instead of sending the recipient through Supabase's.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(await resolveSignedInRedirect(supabase, origin, "google"));
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
