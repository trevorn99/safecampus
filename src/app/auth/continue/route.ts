import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedInRedirect } from "@/lib/postSignIn";

// Where the sign-in page sends the browser once a typed code has been
// accepted. The code is verified client-side, which sets the session
// cookie, but the decisions that follow a sign-in — MFA, activating a
// pending member, claiming a roster entry by email — belong on the server
// and must not be skippable, so they run here exactly as they do for
// /auth/callback and /auth/confirm.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }
  return NextResponse.redirect(await resolveSignedInRedirect(supabase, origin, "email_code"));
}
