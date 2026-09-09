import Link from "next/link";
import Image from "next/image";
import styles from "@/styles/ui.module.css";

// Landing page for the unsubscribe link in a reminder email. Deliberately
// public and session-free — someone clicking "unsubscribe" in their mail
// client shouldn't be bounced to a sign-in form first.
export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className={styles.authShell}>
      <div className={styles.authCard}>
        <div className={styles.authBrand}>
          <Image src="/images/logo-mark.png" alt="" width={28} height={28} className={styles.logo} />
          <span className={styles.wordmark}>
            Safe<span className={styles.wordmarkAccent}>Campus</span>
          </span>
        </div>
        <div>
          <h1 className={styles.title}>{error ? "That link didn't work" : "You're unsubscribed"}</h1>
          <p className={styles.subtitle}>
            {error
              ? "The link may have expired. You can turn shift reminder emails off from your account settings instead."
              : "You won't get any more shift reminder emails. Sign-in links and invites aren't reminders, so those still reach you."}
          </p>
        </div>
        <Link href="/account/mfa" className={styles.link}>
          Account settings →
        </Link>
      </div>
    </main>
  );
}
