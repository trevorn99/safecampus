import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, getAppCredentials } from "@/lib/planningCenter";

const STATE_COOKIE = "pco_oauth_state";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");

  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !returnedState || !rawCookie) {
    return NextResponse.redirect(`${origin}/schedule/integrations?error=missing_state`);
  }

  let expected: { state: string; organizationId: string };
  try {
    expected = JSON.parse(rawCookie);
  } catch {
    return NextResponse.redirect(`${origin}/schedule/integrations?error=invalid_state`);
  }

  if (expected.state !== returnedState) {
    return NextResponse.redirect(`${origin}/schedule/integrations?error=state_mismatch`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", expected.organizationId)
    .maybeSingle();
  if (!member) {
    return NextResponse.redirect(`${origin}/schedule/integrations?error=not_a_member`);
  }

  const credentials = await getAppCredentials(expected.organizationId);
  if (!credentials) {
    return NextResponse.redirect(`${origin}/schedule/integrations?error=no_credentials`);
  }

  try {
    const tokens = await exchangeCodeForTokens(
      credentials,
      code,
      `${origin}/api/integrations/planning-center/callback`,
    );

    const admin = createAdminClient();
    await admin.from("pco_connections").upsert(
      {
        organization_id: expected.organizationId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope,
        connected_by: member.id,
      },
      { onConflict: "organization_id" },
    );
    await admin
      .from("organizations")
      .update({ pco_connected: true })
      .eq("id", expected.organizationId);
  } catch {
    return NextResponse.redirect(`${origin}/schedule/integrations?error=token_exchange_failed`);
  }

  return NextResponse.redirect(`${origin}/schedule/integrations?connected=1`);
}
