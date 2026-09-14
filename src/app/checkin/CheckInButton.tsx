"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

// Trust-based to start: pressing this records that you're here. The
// attendance table already carries a `method` of qr/geofence/manual, so
// tightening this later changes how the row is produced rather than what's
// stored.
export function CheckInButton({
  memberId,
  eventId,
  eventPositionId,
  locationId,
  attendance,
}: {
  memberId: string;
  eventId: string;
  eventPositionId: string;
  locationId: string | null;
  attendance: { id: string; checked_in_at: string; checked_out_at: string | null } | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function checkIn() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    // Upsert on (member, event): the unique index means a double tap, or a
    // retry after a dropped connection, lands on the row that already exists
    // rather than recording somebody twice.
    const { error: insertError } = await supabase.from("attendance").upsert(
      {
        member_id: memberId,
        event_id: eventId,
        event_position_id: eventPositionId,
        location_id: locationId,
        method: "manual",
      },
      { onConflict: "member_id,event_id", ignoreDuplicates: true },
    );
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.refresh();
  }

  async function checkOut() {
    if (!attendance) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("attendance")
      .update({ checked_out_at: new Date().toISOString() })
      .eq("id", attendance.id)
      .select("id");
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    // RLS doesn't reject an update it disallows — it matches nothing — so a
    // blocked check-out would otherwise look like a saved one.
    if (!data || data.length === 0) {
      setError("That didn't save — ask an admin to check you out.");
      return;
    }
    router.refresh();
  }

  if (attendance?.checked_out_at) {
    return <p className={styles.helperText}>Checked out. Thanks for covering this.</p>;
  }

  if (attendance) {
    return (
      <>
        <p className={styles.helperText}>
          Checked in at{" "}
          {new Date(attendance.checked_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
        </p>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          disabled={loading}
          onClick={checkOut}
        >
          {loading ? "Saving…" : "Check out"}
        </button>
        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading} onClick={checkIn}>
        {loading ? "Checking in…" : "Check in"}
      </button>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
