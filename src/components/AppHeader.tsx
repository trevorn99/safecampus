import Link from "next/link";
import styles from "@/styles/ui.module.css";
import { AppNav, type NavEntry } from "@/components/AppNav";

function buildNav(isAdmin: boolean, isPlatformAdmin: boolean): NavEntry[] {
  const items: NavEntry[] = [
    { href: "/dashboard", label: "Dashboard" },
    {
      label: "Schedule",
      items: [
        { href: "/schedule", label: "Calendar" },
        // Series and templates are how a schedule is built, so they belong
        // beside the calendar rather than as buttons on it. Integrations moved
        // out to Organization: connecting Planning Center is an account-level
        // setup job, done once, not part of running the schedule.
        ...(isAdmin
          ? [
              { href: "/schedule/series", label: "Recurring series" },
              { href: "/schedule/templates", label: "Templates" },
              { href: "/schedule/event-types", label: "Event types" },
            ]
          : []),
      ],
    },
    {
      label: "Team",
      items: [
        { href: "/team", label: "Roster" },
        { href: "/certifications", label: "Certifications" },
        ...(isAdmin ? [{ href: "/teams", label: "Manage teams" }] : []),
      ],
    },
    { href: "/threat-intelligence", label: "Threat Intelligence" },
    ...(isAdmin ? [{ href: "/analytics", label: "Analytics" }] : []),
    { href: "/account/mfa", label: "Account" },
    ...(isAdmin
      ? [
          {
            label: "Organization",
            items: [
              { href: "/organization", label: "Settings" },
              { href: "/schedule/integrations", label: "Integrations" },
              // Campuses are organization structure, not people management —
              // they define where events happen and scope location_manager
              // roles, so they sit with Settings rather than under Team.
              { href: "/locations", label: "Locations" },
              { href: "/billing", label: "Billing" },
              { href: "/audit-log", label: "Audit log" },
            ],
          },
        ]
      : []),
    {
      label: "Support",
      items: [
        { href: "/support", label: "Get help" },
        { href: "/help", label: "Documentation" },
      ],
    },
  ];

  if (isPlatformAdmin) {
    items.push({ href: "/platform-admin", label: "Platform" });
  }

  return items;
}

export function AppHeader({
  isAdmin,
  isPlatformAdmin = false,
}: {
  isAdmin: boolean;
  isPlatformAdmin?: boolean;
}) {
  const items = buildNav(isAdmin, isPlatformAdmin);

  return (
    <header className={styles.appHeader}>
      <div className={styles.appHeaderInner}>
        <div className={styles.appHeaderLeft}>
          <Link href="/dashboard" className={styles.wordmark}>
            Safe<span className={styles.wordmarkAccent}>Campus</span>
          </Link>
          <span className={styles.devBadge}>Beta</span>
          <AppNav items={items} />
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" className={styles.navLink}>
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
