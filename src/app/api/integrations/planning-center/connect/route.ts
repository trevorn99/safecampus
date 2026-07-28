import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl, getAppCredentials } from "@/lib/planningCenter";

const STATE_COOKIE = "pco_oauth_state";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: member } = await supabase
    .from("members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: member.organization_id });
  if (!isAdmin) {
    return NextResponse.redirect(new URL("/schedule", request.url));
  }

  const credentials = await getAppCredentials(member.organization_id);
  if (!credentials) {
    return NextResponse.redirect(
      new URL("/schedule/planning-center?error=no_credentials", request.url),
    );
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, JSON.stringify({ state, organizationId: member.organization_id }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/integrations/planning-center/callback`;
  return NextResponse.redirect(buildAuthorizeUrl(credentials.clientId, redirectUri, state));
}
