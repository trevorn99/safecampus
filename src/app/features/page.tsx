import { SiteHeader } from "@/components/SiteHeader";
import styles from "@/styles/ui.module.css";

const FEATURES = [
  {
    title: "Team rosters & scoped roles",
    description:
      "Manage members across every campus and team, with roles that scale with your organization — org admin, location manager, team lead, or member — each scoped to exactly where they lead. Add or remove someone from multiple teams right from the roster.",
  },
  {
    title: "Scheduling & recurring events",
    description:
      "Build a position template once — who's needed, where, and when relative to the event — and reuse it for one-off events or recurring shifts (weekly, every 3rd week, however your schedule actually runs). Give events a start and end time, and define your own event types instead of a fixed list — services, drills, trainings, whatever your organization runs.",
  },
  {
    title: "Training & attendance",
    description:
      "Schedule a training just like any other event, then track who actually showed up with a simple check-in/check-out on the day — no separate system to keep in sync with your roster.",
  },
  {
    title: "Planning Center integration",
    description:
      "Connect your own Planning Center account and pull in upcoming calendar events on demand. Nothing gets added to your schedule automatically — you choose which events actually need a safety team presence.",
  },
  {
    title: "Self-service certifications",
    description:
      "Members upload their own certifications and supporting documents. Admins track expirations and compliance across the whole team from one place — and can require specific certifications or trainings for a team, with each member's status visible at a glance.",
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
    title: "Analytics",
    description:
      "A dashboard for org admins: scheduling fill rate over time, event activity by type, attendance counts, and upcoming certification expirations — a read on how your team's actually running, not just a calendar of what's next.",
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
      "One AI-drafted intelligence brief covering your whole organization — every location combined — refreshing weekly and available on demand, drawing on incident history, watchlist activity, public web search, X/Twitter search, and government advisories (DHS, FBI/CISA), reviewed by your admins before release. Certain platforms (private Facebook groups, Instagram, TikTok) can't be monitored via API in an automated way — always pair this with your team's own human intelligence.",
  },
  {
    title: "Identity Verification ($10/mo add-on)",
    description:
      "Require every member to verify their identity with a government-issued photo ID and a live selfie before they can use the app, through Stripe Identity's hosted flow — SafeCampus never sees or stores the document itself. Org admins are always exempt, so turning this on can never lock you out of your own organization.",
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
