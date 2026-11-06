"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

// Short enough to sit on one line with both buttons on a phone. The marks
// keep a status from reading as one more button now that all three share
// a shape.
const STATUS_LABEL: Record<string, string> = {
  proposed: "Awaiting reply",
  confirmed: "✓ Confirmed",
  declined: "✕ Declined",
};

export function AssignmentStatusButtons({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  async function setStatus(next: "confirmed" | "declined") {
    setLoading(true);
    setError("");
    const supabase = createClient();
    // .select() so a change RLS refuses — which comes back as zero rows, not
    // an error — doesn't show "Confirmed" for a response that was never saved.
    const { data, error: updateError } = await supabase
      .from("assignments")
      .update({ status: next })
      .eq("id", assignmentId)
      .select("id");
    setLoading(false);
    if (updateError || !data || data.length === 0) {
      setError("That didn't save. Refresh the page and try again.");
      return;
    }
    setCurrent(next);
    router.refresh();
  }

  // The status and both actions share one rounded shape and one text size.
  // The status used to be a small rounded tag beside full-size square
  // buttons, which on a phone — where buttons grow to a 44px tap height —
  // looked like three unrelated controls of different sizes.
  const chipClass =
    current === "confirmed" ? styles.statusChipConfirmed : current === "declined" ? styles.statusChipDeclined : styles.statusChip;

  return (
    <div className={styles.tagRow}>
      <span className={chipClass}>{STATUS_LABEL[current] ?? current}</span>
      {current !== "confirmed" && (
        <button
          type="button"
          className={styles.statusConfirm}
          disabled={loading}
          onClick={() => setStatus("confirmed")}
        >
          Confirm
        </button>
      )}
      {current !== "declined" && (
        <button
          type="button"
          className={styles.statusDecline}
          disabled={loading}
          onClick={() => setStatus("declined")}
        >
          Decline
        </button>
      )}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
