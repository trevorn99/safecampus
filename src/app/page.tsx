import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "@/styles/ui.module.css";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className={styles.homeHero}>
        <div className={styles.homeHeroContent}>
          <p className={styles.eyebrow}>Vigilance, Coordinated</p>
          <h1 className={styles.heroTitle}>Team management for safety teams of every kind</h1>
          <p className={styles.heroDescription}>
            SafeCampus gives your safety team one place to manage rosters, build schedules, track
            certifications, and coordinate every event — across every location, every team, and
            every member — so everyone knows where to be and what&apos;s expected of them.
          </p>
          <div className={styles.heroActions}>
            <a href="/login" className={`${styles.button} ${styles.buttonPrimary}`}>
              Sign in
            </a>
            <a href="/features" className={`${styles.button} ${styles.buttonSecondary}`}>
              See features
            </a>
          </div>
        </div>
        <div className={styles.homeHeroVisual}>
          <Image
            src="/images/largelogo.png"
            alt="SafeCampus — a guardian standing watch over the campus skyline"
            width={784}
            height={1168}
            priority
            className={styles.homeHeroImage}
          />
        </div>
      </main>
    </>
  );
}
