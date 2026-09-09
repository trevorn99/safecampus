"use client";

import { useEffect } from "react";
import styles from "@/styles/ui.module.css";

// Opens the browser's print dialog once the report has rendered. "Save as
// PDF" is a destination in that dialog on every current browser, which is
// what makes this a PDF export without a rendering dependency — the output
// is real vector text, not a screenshot.
export function AutoPrint() {
  useEffect(() => {
    // A frame's delay so fonts and markdown are laid out before the dialog
    // freezes the page; printing mid-layout produces a blank first page.
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={styles.actions} data-print="hide">
      <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => window.print()}>
        Print / Save as PDF
      </button>
    </div>
  );
}
