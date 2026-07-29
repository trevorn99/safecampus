import { SiteHeader } from "@/components/SiteHeader";
import styles from "@/styles/ui.module.css";

const FEATURES = [
  {
    title: "Team rosters & scoped roles",
    description:
      "Manage members across every campus and team, with roles that scale with your organization — org admin, location manager, team lead, or member — each scoped to exactly where they lead.",
  },
  {
    title: "Scheduling & recurring events",
    description:
      "Build a position template once — who's needed, where, and when relative to the event — and reuse it for one-off events or recurring shifts (weekly, every 3rd week, however your schedule actually runs).",
  },
  {
    title: "Planning Center integration",
    description:
      "Connect your own Planning Center account and pull in upcoming calendar events on demand. Nothing gets added to your schedule automatically — you choose which events actually need a safety team presence.",
  },
  {
    title: "Self-service certifications",
    description:
      "Members upload their own certifications and supporting documents. Admins track expirations and compliance across the whole team from one place.",
  },
  {
    title: "Location maps & position pins",
    description:
      "Upload a campus map or floor plan and pin exactly where each position stands, so new volunteers know precisely where to go.",
  },
  {
    title: "Multi-campus support",
    description:
      "One organization, multiple locations, each with its own teams and leadership — without duplicating your setup for every campus.",
  },
  {
    title: "Passwordless, secure sign-in",
    description:
      "Sign in with a magic link or Google — no passwords to manage. Every organization's data is isolated at the database level, so one organization can never see another's.",
  },
  {
    title: "SMS shift reminders",
    description:
      "Members can opt in to a text 3 days and 24 hours before a shift they're assigned to — no app to check, just a reminder that shows up.",
  },
  {
    title: "Incident reports & watchlist",
    description:
      "A restricted, audited record for incidents and individuals of concern, visible only to admins and location leadership.",
    comingSoon: true,
  },
  {
    title: "Threat Intelligence ($30/mo add-on)",
    description:
      "AI-drafted intelligence briefs for each location, refreshing weekly and available on demand — drawing on incident history, watchlist activity, public web search, and government advisories (DHS, FBI/CISA), reviewed by your admins before release. Does not access private social media (Facebook groups, Instagram, TikTok).",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.hero}>
        <h1 className={styles.heroTitle}>Everything your safety team needs</h1>
        <p className={styles.heroDescription}>
          Built specifically for safety and security teams — not a generic scheduling tool
          repurposed for the job.
        </p>
      </main>
      <div className={styles.featuresSection}>
        <div className={styles.featureGrid}>
          {FEATURES.map((feature) => (
            <div key={feature.title} className={styles.featureCard}>
              {feature.comingSoon && <span className={styles.badge}>Coming soon</span>}
              <h2 className={styles.featureTitle}>{feature.title}</h2>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
        <a href="/login" className={`${styles.button} ${styles.buttonPrimary}`}>
          Sign in to get started
        </a>
      </div>
    </>
  );
}
