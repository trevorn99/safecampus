import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicOrigin } from "@/lib/siteUrl";
import { checkSignInCodeLimits, normalizeEmail, sendSignInCode } from "@/lib/signInCode";

// Public by necessity — whoever is signing in has no session yet — so every
// request is rate limited (lib/signInCode.ts) and the response never says
// whether the address has an account.
export async function POST(request: Request) {
  let body: { email?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Falls through to the invalid-address response.
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Vercel sets x-forwarded-for itself, so its first entry is the client.
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

  const admin = createAdminClient();
  const limit = await checkSignInCodeLimits(admin, email, clientIp);
  if (!limit.ok) {
    return NextResponse.json(
      { error: limit.message },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const result = await sendSignInCode({
    admin,
    origin: publicOrigin(new URL(request.url).origin),
    email,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
