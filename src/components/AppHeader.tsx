import styles from "@/styles/ui.module.css";
import { AppNav, type NavEntry } from "@/components/AppNav";

function buildNav(isAdmin: boolean, isPlatformAdmin: boolean): NavEntry[] {
  const items: NavEntry[] = [
    { href: "/dashboard", label: "Dashboard" },
    {
      label: "Schedule",
      items: [
        { href: "/schedule", label: "Calendar" },
        { href: "/schedule/integrations", label: "Integrations" },
      ],
    },
    {
      label: "Team",
      items: [
        { href: "/team", label: "Roster" },
        { href: "/certifications", label: "Certifications" },
        ...(isAdmin
          ? [
              { href: "/teams", label: "Manage teams" },
              { href: "/locations", label: "Locations" },
            ]
          : []),
      ],
    },
    { href: "/threat-intelligence", label: "Threat Intelligence" },
    ...(isAdmin ? [{ href: "/analytics", label: "Analytics" }] : []),
    isAdmin
      ? {
          label: "Account",
          items: [
            { href: "/account/mfa", label: "Security & MFA" },
            { href: "/billing", label: "Billing" },
            { href: "/audit-log", label: "Audit log" },
          ],
        }
      : { href: "/account/mfa", label: "Account" },
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
          <a href="/dashboard" className={styles.wordmark}>
            Safe<span className={styles.wordmarkAccent}>Campus</span>
          </a>
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
