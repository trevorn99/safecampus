import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "@/styles/ui.module.css";

const HOME_FEATURES = [
  {
    title: "Team rosters & scoped roles",
    description:
      "Manage members across every location and team, with roles that scale with your organization — org admin, location manager, team lead, or member.",
  },
  {
    title: "Scheduling & recurring events",
    description:
      "Build a position template once and reuse it for one-off events or recurring shifts — weekly, every 3rd week, however your schedule actually runs.",
  },
  {
    title: "Self-service certifications",
    description:
      "Members upload their own certifications and supporting documents. Admins track expirations and compliance from one place.",
  },
  {
    title: "Location maps & position pins",
    description:
      "Upload a campus map or floor plan and pin exactly where each position stands, so team members know precisely where to go.",
  },
  {
    title: "Multi-location support",
    description:
      "One organization, multiple locations, each with its own teams and leadership — without duplicating your setup for every site.",
  },
  {
    title: "Passwordless, secure sign-in",
    description:
      "Sign in with a magic link or Google — no passwords to manage. Every organization's data is isolated at the database level.",
  },
];

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
      <section className={styles.homeFeaturesSection}>
        <div className={styles.homeFeaturesHeading}>
          <p className={styles.eyebrow}>What you get</p>
          <h2 className={styles.homeFeaturesTitle}>Everything your safety team needs, in one place</h2>
        </div>
        <div className={styles.featureGrid}>
          {HOME_FEATURES.map((feature) => (
            <div key={feature.title} className={styles.featureCard}>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
        <a href="/features" className={styles.link}>
          See all features →
        </a>
      </section>
    </>
  );
}
