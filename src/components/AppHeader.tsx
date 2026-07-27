import styles from "@/styles/ui.module.css";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/team", label: "Team" },
  { href: "/certifications", label: "Certifications" },
  { href: "/account/mfa", label: "Security" },
];

const ADMIN_NAV_ITEMS = [
  { href: "/locations", label: "Locations" },
  { href: "/teams", label: "Teams" },
  { href: "/billing", label: "Billing" },
];

const PLATFORM_ADMIN_NAV_ITEMS = [{ href: "/platform-admin", label: "Platform" }];

export function AppHeader({
  isAdmin,
  isPlatformAdmin = false,
}: {
  isAdmin: boolean;
  isPlatformAdmin?: boolean;
}) {
  const items = [
    ...NAV_ITEMS,
    ...(isAdmin ? ADMIN_NAV_ITEMS : []),
    ...(isPlatformAdmin ? PLATFORM_ADMIN_NAV_ITEMS : []),
  ];

  return (
    <header className={styles.appHeader}>
      <div className={styles.appHeaderInner}>
        <div className={styles.appHeaderLeft}>
          <a href="/dashboard" className={styles.wordmark}>
            Safe<span className={styles.wordmarkAccent}>Campus</span>
          </a>
          <span className={styles.devBadge}>Beta</span>
          <nav className={styles.appNav}>
            {items.map((item) => (
              <a key={item.href} href={item.href} className={styles.navLink}>
                {item.label}
              </a>
            ))}
          </nav>
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
