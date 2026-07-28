import styles from "@/styles/ui.module.css";

// Pulled out of the component body — react-hooks/purity flags impure calls
// (Date construction with no args) made directly during render.
function currentYear(): number {
  return new Date().getFullYear();
}

export function SiteFooter() {
  return (
    <footer className={styles.siteFooter}>
      <div className={styles.siteFooterInner}>
        <span>&copy; {currentYear()} SafeCampus</span>
        <nav className={styles.siteFooterLinks}>
          <a href="/features">Features</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </div>
    </footer>
  );
}
