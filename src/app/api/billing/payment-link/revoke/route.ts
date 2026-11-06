import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/orgAdminRequest";
import { revokePaymentLinks } from "@/lib/paymentLinks";

export async function POST() {
  const auth = await requireOrgAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { error } = await revokePaymentLinks(createAdminClient(), auth.admin.organizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
