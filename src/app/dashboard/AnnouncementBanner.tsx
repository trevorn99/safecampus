"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export type BannerAnnouncement = {
  id: string;
  subject: string;
  body: string;
  senderName: string;
  createdAt: string;
};

// Unread announcements on the dashboard, so one reaches people who don't
// read email. Dismissing hides it here for good; it stays on the
// Announcements page.
export function AnnouncementBanner({ memberId, items }: { memberId: string; items: BannerAnnouncement[] }) {
  const [visible, setVisible] = useState(items);
  const [error, setError] = useState("");

  async function dismiss(id: string) {
    setError("");
    const supabase = createClient();
    // .select() so a dismissal RLS refused doesn't vanish now and come back
    // on the next visit.
    const { data, error: updateError } = await supabase
      .from("announcement_recipients")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("announcement_id", id)
      .eq("member_id", memberId)
      .select("announcement_id");
    if (updateError || !data || data.length === 0) {
      setError("Couldn't dismiss that. Refresh the page and try again.");
      return;
    }
    setVisible((current) => current.filter((item) => item.id !== id));
  }

  if (visible.length === 0) return null;

  return (
    <div className={styles.announcementBanner} role="region" aria-label="Announcements">
      {visible.map((item) => (
        <div key={item.id} className={styles.announcementBannerItem}>
          <div className={styles.announcementBannerText}>
            <p className={styles.itemName}>{item.subject}</p>
            <p className={styles.itemMeta}>
              From {item.senderName} ·{" "}
              {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
            {/* Flattened for the preview: blank lines between paragraphs would
                spend the three-line clamp on nothing. The full message keeps
                its formatting on the Announcements page. */}
            <p className={styles.announcementBannerBody}>{item.body.replace(/\s+/g, " ")}</p>
            <Link href="/announcements" className={styles.link}>
              Read in full
            </Link>
          </div>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonCompact}`}
            onClick={() => void dismiss(item.id)}
          >
            Dismiss
          </button>
        </div>
      ))}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
