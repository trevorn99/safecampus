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
];

export function AppHeader({ isAdmin }: { isAdmin: boolean }) {
  const items = isAdmin ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  return (
    <header className={styles.appHeader}>
      <div className={styles.appHeaderInner}>
        <div className={styles.appHeaderLeft}>
          <a href="/dashboard" className={styles.wordmark}>
            Safe<span className={styles.wordmarkAccent}>Campus</span>
          </a>
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
