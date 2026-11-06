"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "@/styles/ui.module.css";

export type NavLeaf = { href: string; label: string };
export type NavEntry = NavLeaf | { label: string; items: NavLeaf[] };

function isGroup(entry: NavEntry): entry is { label: string; items: NavLeaf[] } {
  return "items" in entry;
}

// Two renderings of the same entries, one shown per screen size by CSS.
//
// The desktop row was the only one, and on a phone it simply ran off the
// edge: an admin's header holds up to ten entries plus the wordmark and
// Sign out, so everything after "Dashboard" was unreachable without typing
// a URL. Below 720px the row is replaced by Check in — kept one tap away,
// since it's what a volunteer opens a phone for while walking in — and a
// Menu button that opens every entry as a full-width list, groups expanded
// under their headings, with Sign out at the end.
export function AppNav({ items, checkInHref }: { items: NavEntry[]; checkInHref?: string }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // A link inside the menu navigates and unmounts nothing, so the menu would
  // stay open over the new page. Closing on the route change itself covers
  // every way of leaving, including the browser's back button.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setOpenLabel(null);
  }

  useEffect(() => {
    if (!openLabel && !menuOpen) return;

    // pointerdown rather than mousedown, so a tap outside closes it on a
    // touchscreen as reliably as a click does.
    function handlePointerDown(event: PointerEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenLabel(null);
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenLabel(null);
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openLabel, menuOpen]);

  // The menu lists everything in sections: each group under its heading,
  // and any run of standalone links as an unheaded section of its own.
  // Without that, links following a group (Threat Intelligence, Analytics,
  // Account after Team) read as though they belonged to it.
  const sections: { label: string | null; items: NavLeaf[] }[] = [];
  for (const entry of items) {
    if (isGroup(entry)) {
      sections.push({ label: entry.label, items: entry.items });
    } else {
      const last = sections[sections.length - 1];
      if (last && last.label === null) last.items.push(entry);
      else sections.push({ label: null, items: [entry] });
    }
  }

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div ref={navRef} className={styles.appNavWrap}>
      <nav className={styles.appNav} aria-label="Main">
        {items.map((entry) =>
          isGroup(entry) ? (
            <div key={entry.label} className={styles.navGroup}>
              <button
                type="button"
                className={styles.navLink}
                aria-expanded={openLabel === entry.label}
                onClick={() => setOpenLabel(openLabel === entry.label ? null : entry.label)}
              >
                {entry.label} <span className={styles.navCaret}>▾</span>
              </button>
              {openLabel === entry.label && (
                <div className={styles.navDropdown}>
                  {entry.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={styles.navDropdownLink}
                      onClick={() => setOpenLabel(null)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link key={entry.href} href={entry.href} className={styles.navLink}>
              {entry.label}
            </Link>
          ),
        )}
      </nav>

      <div className={styles.mobileNavControls}>
        {checkInHref && (
          <Link href={checkInHref} className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonCompact}`}>
            Check in
          </Link>
        )}
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonCompact}`}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>

      {menuOpen && (
        <nav id="mobile-nav-menu" className={styles.mobileNavMenu} aria-label="Main">
          {sections.map((section, index) => (
            <div key={section.label ?? `links-${index}`} className={styles.mobileNavGroup}>
              {section.label && <p className={styles.mobileNavHeading}>{section.label}</p>}
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.mobileNavLink}
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          <form action="/auth/signout" method="post" className={styles.mobileNavGroup}>
            <button type="submit" className={styles.mobileNavLink}>
              Sign out
            </button>
          </form>
        </nav>
      )}
    </div>
  );
}
