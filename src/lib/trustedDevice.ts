import "server-only";
import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const TRUSTED_DEVICE_COOKIE = "sc_trusted_device";
const TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Only ever call this immediately after a real MFA verification succeeds —
// it records trust, it doesn't grant it.
export async function trustThisDevice(userId: string, userAgent: string | null): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const admin = createAdminClient();
  await admin.from("mfa_trusted_devices").insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + TRUST_DURATION_MS).toISOString(),
    user_agent: userAgent,
  });

  const cookieStore = await cookies();
  cookieStore.set(TRUSTED_DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: TRUST_DURATION_MS / 1000,
    path: "/",
  });
}

// Whether the current request's cookie matches an unexpired, un-revoked
// trust record for this specific user. Skips our own app-level MFA
// redirect only — see the migration comment for what this does not do.
export async function isTrustedDeviceRequest(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value;
  if (!token) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("mfa_trusted_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return false;
  await admin.from("mfa_trusted_devices").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return true;
}

export async function forgetAllTrustedDevices(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("mfa_trusted_devices").delete().eq("user_id", userId);

  const cookieStore = await cookies();
  cookieStore.delete(TRUSTED_DEVICE_COOKIE);
}
