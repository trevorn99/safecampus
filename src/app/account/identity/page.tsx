import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { StartVerificationButton } from "./StartVerificationButton";
import { IdentityStatusPoller } from "./IdentityStatusPoller";
import styles from "@/styles/ui.module.css";

export default async function IdentityVerificationPage() {
  // Bypasses its own gate (it IS the gate's destination) but still respects
  // the paywall — an org without an active subscription can't have this
  // add-on enabled in the first place.
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership({
    allowUnverified: true,
  });

  const { data: current } = await supabase
    .from("members")
    .select("identity_verification_status, identity_verification_error")
    .eq("id", member.id)
    .single();

  const status = current?.identity_verification_status ?? "unverified";

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Identity verification</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        {status !== "verified" && (
          <p className={styles.disclaimer}>
            {organizationName} has turned on a requirement that every member verify their identity — this isn&apos;t
            specific to your account, and access to the rest of the app is on hold for everyone until they
            complete it. If you have questions about why this is required, or run into a problem verifying,
            contact your organization&apos;s admin — they&apos;re the only ones who can turn this requirement off.
          </p>
        )}

        <div className={styles.card}>
          {status === "verified" && (
            <>
              <div className={styles.cardHeader}>
                <span className={styles.badge}>Verified</span>
                <h2 className={styles.cardTitle}>You&apos;re all set</h2>
                <p className={styles.helperText}>Your identity has been verified.</p>
              </div>
              <Link href="/dashboard" className={`${styles.button} ${styles.buttonPrimary}`}>
                Continue to dashboard
              </Link>
            </>
          )}

          {status === "pending" && (
            <>
              <IdentityStatusPoller />
              <div className={styles.cardHeader}>
                <span className={styles.pillMuted}>Pending</span>
                <h2 className={styles.cardTitle}>Verification in progress</h2>
                <p className={styles.helperText}>
                  Stripe is reviewing what you submitted — this page will update automatically, usually within a
                  few minutes. If you closed the verification window before finishing, start over below.
                </p>
              </div>
              <StartVerificationButton label="Start over" />
            </>
          )}

          {(status === "unverified" || status === "failed") && (
            <>
              <div className={styles.cardHeader}>
                {status === "failed" && <span className={styles.pillDanger}>Not verified</span>}
                <h2 className={styles.cardTitle}>
                  {status === "failed" ? "Let's try again" : "Verify your identity"}
                </h2>
                <p className={styles.helperText}>
                  {organizationName} requires every member to verify their identity before using the app. You&apos;ll
                  need a government-issued photo ID and a live selfie — handled entirely by Stripe&apos;s hosted
                  verification flow; SafeCampus never sees or stores your ID.
                </p>
                {status === "failed" && current?.identity_verification_error && (
                  <p className={styles.errorText} role="alert">
                    {current.identity_verification_error}
                  </p>
                )}
              </div>
              <StartVerificationButton label={status === "failed" ? "Try again" : "Start verification"} />
            </>
          )}
        </div>
      </main>
    </>
  );
}
