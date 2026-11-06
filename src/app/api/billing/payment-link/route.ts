import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/orgAdminRequest";
import { publicOrigin } from "@/lib/siteUrl";
import { normalizeEmail } from "@/lib/signInCode";
import { quoteSubscription } from "@/lib/subscriptionCheckout";
import { createPaymentLink, sendPaymentLinkEmail } from "@/lib/paymentLinks";

// An org admin asks someone outside the organization to pay. See
// lib/paymentLinks.ts.
export async function POST(request: Request) {
  const auth = await requireOrgAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { email?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Falls through to the invalid-address response.
  }
  const payerEmail = normalizeEmail(body.email);
  if (!payerEmail) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const admin = createAdminClient();
  // Refuse up front rather than mail a link that would only say "already
  // subscribed" or "contact us" when opened.
  const quoted = await quoteSubscription(admin, auth.admin.organizationId);
  if (!quoted.ok) return NextResponse.json({ error: quoted.error }, { status: quoted.status });

  const created = await createPaymentLink({
    admin,
    organizationId: auth.admin.organizationId,
    payerEmail,
    createdBy: auth.admin.memberId,
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });

  const origin = publicOrigin(new URL(request.url).origin);
  const sent = await sendPaymentLinkEmail({
    origin,
    orgName: quoted.quote.orgName,
    requesterName: auth.admin.name,
    payerEmail,
    url: `${origin}/pay/${created.token}`,
    expiresAt: created.expiresAt,
  });
  if (!sent.ok) {
    return NextResponse.json(
      { error: `The link was created but the email didn't send: ${sent.error}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, expiresAt: created.expiresAt.toISOString() });
}
