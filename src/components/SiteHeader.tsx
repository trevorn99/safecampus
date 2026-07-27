import Image from "next/image";
import Link from "next/link";
import styles from "@/styles/ui.module.css";

export function SiteHeader() {
  return (
    <header className={styles.siteHeader}>
      <div className={styles.siteHeaderInner}>
        <Link href="/" className={styles.siteHeaderBrand}>
          <Image src="/images/logo-mark.png" alt="" width={32} height={32} className={styles.logo} />
          <span className={styles.wordmark}>
            Safe<span className={styles.wordmarkAccent}>Campus</span>
          </span>
          <span className={styles.devBadge}>Beta</span>
        </Link>
        <nav className={styles.siteNav}>
          <a href="/features" className={styles.navLink}>
            Features
          </a>
          <a href="/login" className={`${styles.button} ${styles.buttonPrimary}`}>
            Sign in
          </a>
        </nav>
      </div>
    </header>
  );
}
