import styles from "@/styles/ui.module.css";

export default function Home() {
  return (
    <main className={styles.authShell}>
      <div className={styles.authCard}>
        <p className={styles.wordmark}>
          Safe<span className={styles.wordmarkAccent}>Campus</span>
        </p>
        <div>
          <h1 className={styles.title}>Team management for church safety teams</h1>
          <p className={styles.subtitle}>
            Rosters, scheduling, certifications, and notifications — all in one place.
          </p>
        </div>
        <a href="/login" className={`${styles.button} ${styles.buttonPrimary}`}>
          Sign in
        </a>
      </div>
    </main>
  );
}
