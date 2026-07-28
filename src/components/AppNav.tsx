"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/styles/ui.module.css";

export type NavLeaf = { href: string; label: string };
export type NavEntry = NavLeaf | { label: string; items: NavLeaf[] };

function isGroup(entry: NavEntry): entry is { label: string; items: NavLeaf[] } {
  return "items" in entry;
}

export function AppNav({ items }: { items: NavEntry[] }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openLabel) return;

    function handlePointerDown(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenLabel(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenLabel(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openLabel]);

  return (
    <nav className={styles.appNav} ref={navRef}>
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
                  <a
                    key={item.href}
                    href={item.href}
                    className={styles.navDropdownLink}
                    onClick={() => setOpenLabel(null)}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <a key={entry.href} href={entry.href} className={styles.navLink}>
            {entry.label}
          </a>
        ),
      )}
    </nav>
  );
}
