import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trustThisDevice } from "@/lib/trustedDevice";

// Called right after a real MFA verification (TOTP or passkey) succeeds, if
// the user opted in to "remember this device." Requires the session to
// already be at AAL2 — this records trust, it never grants it.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    return NextResponse.json({ error: "MFA verification required" }, { status: 403 });
  }

  await trustThisDevice(user.id, request.headers.get("user-agent"));
  return NextResponse.json({ ok: true });
}
