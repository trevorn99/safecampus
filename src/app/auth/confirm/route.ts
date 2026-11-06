import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedInRedirect } from "@/lib/postSignIn";

// Where every link in a SafeCampus email lands, so that the address under
// the button belongs to SafeCampus.
//
// Supabase's own verify endpoint works perfectly well, but it means the link
// in an invitation reads https://<project-ref>.supabase.co/auth/v1/verify?…
// — an unfamiliar domain, with a random-looking subdomain, in exactly the
// message a cautious recipient is already squinting at. Verifying the token
// here instead keeps the whole journey on one hostname, and costs nothing:
// generateLink hands back the hashed token for this purpose, and the
// Supabase email templates expose it as {{ .TokenHash }}.
//
// Note that this consumes the token, so it must not be behind anything that
// prefetches links. Email clients and scanners that fetch a URL to preview
// it will burn the link — which is true of Supabase's endpoint too, and why
// these are one-shot by design rather than a regression introduced here.

// Only the email types this app actually sends. An unbounded `type` would
// let a caller pass anything straight into verifyOtp.
const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "invite",
  "magiclink",
  "signup",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // What the dead link was for, so /login can say "that invitation" rather
  // than "that sign-in link" to someone who has never signed in and doesn't
  // yet think of themselves as having an account. Only ever one of the
  // values below, never the raw parameter.
  const valid = Boolean(type) && EMAIL_OTP_TYPES.has(type as EmailOtpType);
  // An invitation sent to an existing account carries a sign-in token, so
  // its `type` says magiclink; `src` is how the failure message still knows
  // to call it an invitation.
  const kind = searchParams.get("src") === "invite" ? "invite" : valid ? type : null;
  const failed = `${origin}/login?error=link${kind ? `&kind=${kind}` : ""}`;

  if (!tokenHash || !valid) {
    return NextResponse.redirect(failed);
  }

  // Sign-in and signup-confirmation tokens are verified as "email", which is
  // Supabase's documented type for token_hash verification of both. Passing
  // "magiclink" through looked right and rejected every such link as
  // expired: the token is stored differently depending on whether the
  // account has been confirmed yet, and only "email" checks both places.
  // Mapped here, rather than only in the links, so links already sitting in
  // inboxes with type=magiclink still work.
  const verifyType: EmailOtpType =
    type === "magiclink" || type === "signup" ? "email" : (type as EmailOtpType);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: verifyType,
    token_hash: tokenHash,
  });

  if (error) {
    // Expired, already used, or not a real token — all the same thing to the
    // person holding it, and all fixed the same way: ask for a new link. But
    // not the same thing to whoever has to debug it, so the reason goes to
    // the server log. Never the token itself.
    console.error("auth/confirm: verifyOtp rejected link", {
      type,
      verifyType,
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return NextResponse.redirect(failed);
  }

  // Relative paths only. `next` comes from a URL in an email, so an absolute
  // one would make this an open redirect: a link on our own domain that
  // bounces an authenticated visitor somewhere else. A leading `//` is
  // protocol-relative and counts as absolute.
  const next = searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(await resolveSignedInRedirect(supabase, origin));
}
