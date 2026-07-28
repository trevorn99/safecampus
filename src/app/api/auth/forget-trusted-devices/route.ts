import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { forgetAllTrustedDevices } from "@/lib/trustedDevice";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await forgetAllTrustedDevices(user.id);
  return NextResponse.json({ ok: true });
}
