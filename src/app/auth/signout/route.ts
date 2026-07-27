import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303, not the default 307: this redirect follows a POST, and 307 would
  // preserve that method — but /login only handles GET.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
