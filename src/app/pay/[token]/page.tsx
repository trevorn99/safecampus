import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPaymentLink } from "@/lib/paymentLinks";
import { quoteSubscription } from "@/lib/subscriptionCheckout";
import { createStripeClient, SEAT_CAPS, TIER_LABEL, TIER_PRICE_IDS } from "@/lib/stripe";
import { PayButton } from "./PayButton";
import styles from "@/styles/ui.module.css";

// Where a payment link lands. Public — the payer has no account — so it
// shows only what they need to decide to pay: the organization, the plan,
// the price and when billing starts. Nothing from inside the organization.
export const metadata: Metadata = {
  title: "Pay for SafeCampus",
  // The token is in this page's address. Keep it out of search indexes,
  // and out of the Referer header sent to anything the page links to.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const longDate = (date: Date) => date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className={styles.authShell}>
        <div className={styles.authCard}>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </div>
      </main>
    </>
  );
}

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;
  const admin = createAdminClient();

  const found = await findPaymentLink(admin, token);
  if (!found.ok) {
    return (
      <Shell title="This payment link isn't valid">
        <p className={styles.subtitle}>
          {found.reason === "expired"
            ? "It has expired."
            : found.reason === "revoked"
              ? "It was replaced by a newer link, or cancelled."
              : "It may have been copied incompletely."}{" "}
          Ask the person who sent it for a new one. Nothing has been charged.
        </p>
      </Shell>
    );
  }

  // Back from Stripe. The subscription arrives by webhook a moment later,
  // so this can't wait for it to be recorded before saying thank you.
  if (paid === "1") {
    return (
      <Shell title="Thank you">
        <p className={styles.subtitle}>
          The subscription is set up. Stripe will email a receipt to {found.link.payerEmail}, and future receipts go
          there too. There&apos;s nothing else you need to do.
        </p>
      </Shell>
    );
  }

  const quoted = await quoteSubscription(admin, found.link.organizationId);
  if (!quoted.ok) {
    return (
      <Shell title={quoted.reason === "subscribed" ? "Already set up" : "Nothing to pay here"}>
        <p className={styles.subtitle}>
          {quoted.reason === "subscribed"
            ? "This organization's subscription is already set up, so there's nothing to pay. Thank you!"
            : quoted.reason === "over_cap"
              ? "This organization needs a custom plan, which can't be paid through this link. Let the person who sent it know."
              : "This organization doesn't need to pay for SafeCampus. Let the person who sent it know."}
        </p>
      </Shell>
    );
  }

  const { quote } = quoted;
  // The price is read from Stripe so this page always matches what checkout
  // will charge, rather than a figure copied into the code.
  const price = await createStripeClient().prices.retrieve(TIER_PRICE_IDS[quote.tier]);
  const amount =
    price.unit_amount !== null
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency }).format(price.unit_amount / 100)
      : null;
  const interval = price.recurring?.interval ?? "month";

  return (
    <Shell title={`Set up ${quote.orgName}'s subscription`}>
      <p className={styles.subtitle}>
        You were asked to pay for {quote.orgName}&apos;s SafeCampus subscription. SafeCampus is the scheduling and
        coordination tool their safety team uses. You don&apos;t need an account.
      </p>

      <div className={styles.card}>
        <p className={styles.itemName}>
          {TIER_LABEL[quote.tier]}
          {amount ? ` — ${amount} per ${interval}` : ""}
        </p>
        <p className={styles.itemMeta}>
          {quote.seatCount} active member{quote.seatCount === 1 ? "" : "s"}. The plan follows the team&apos;s size and
          moves up automatically past {SEAT_CAPS[quote.tier]} members.
        </p>
        <p className={styles.itemMeta}>
          {quote.trialCarriesUntil
            ? `They're on a free trial, so you won't be charged until ${longDate(quote.trialCarriesUntil)}.`
            : "Billing starts today."}{" "}
          Receipts go to {found.link.payerEmail}.
        </p>
      </div>

      <PayButton token={token} />

      <p className={styles.hint}>
        Payment is handled by Stripe; SafeCampus never sees your card details. This link works until{" "}
        {longDate(found.link.expiresAt)}. If you weren&apos;t expecting it, check with {quote.orgName} before paying.
      </p>
    </Shell>
  );
}
