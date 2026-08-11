"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import styles from "@/styles/ui.module.css";

type Member = { id: string; name: string; avatarUrl: string | null };
type AttendanceRow = { id: string; member_id: string; checked_in_at: string; checked_out_at: string | null };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function AttendanceCard({
  eventId,
  locationId,
  members,
  initialAttendance,
}: {
  eventId: string;
  locationId: string | null;
  members: Member[];
  initialAttendance: AttendanceRow[];
}) {
  const router = useRouter();
  const [attendance, setAttendance] = useState<Map<string, AttendanceRow>>(
    new Map(initialAttendance.map((row) => [row.member_id, row])),
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function checkIn(memberId: string) {
    setLoadingId(memberId);
    setError("");
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("attendance")
      .insert({ member_id: memberId, event_id: eventId, location_id: locationId, method: "manual" })
      .select("id, member_id, checked_in_at, checked_out_at")
      .single();
    setLoadingId(null);
    if (insertError || !data) {
      setError(insertError?.message ?? "Something went wrong");
      return;
    }
    setAttendance((prev) => new Map(prev).set(memberId, data));
    router.refresh();
  }

  async function checkOut(row: AttendanceRow) {
    setLoadingId(row.member_id);
    setError("");
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("attendance")
      .update({ checked_out_at: new Date().toISOString() })
      .eq("id", row.id)
      .select("id, member_id, checked_in_at, checked_out_at")
      .single();
    setLoadingId(null);
    if (updateError || !data) {
      setError(updateError?.message ?? "Something went wrong");
      return;
    }
    setAttendance((prev) => new Map(prev).set(row.member_id, data));
    router.refresh();
  }

  async function undo(row: AttendanceRow) {
    setLoadingId(row.member_id);
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("attendance").delete().eq("id", row.id);
    setLoadingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setAttendance((prev) => {
      const next = new Map(prev);
      next.delete(row.member_id);
      return next;
    });
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Attendance</h2>
        <p className={styles.helperText}>{attendance.size} of {members.length} checked in</p>
      </div>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
      <ul className={styles.list}>
        {members.map((member) => {
          const row = attendance.get(member.id);
          const busy = loadingId === member.id;
          return (
            <li key={member.id} className={styles.listRow}>
              <div className={styles.identityRow}>
                <Avatar name={member.name} url={member.avatarUrl} />
                <p className={styles.itemName}>{member.name}</p>
              </div>
              <div className={styles.tagRow}>
                {!row && (
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonSecondary}`}
                    disabled={busy}
                    onClick={() => checkIn(member.id)}
                  >
                    {busy ? "Checking in…" : "Check in"}
                  </button>
                )}
                {row && !row.checked_out_at && (
                  <>
                    <span className={styles.pill}>In {formatTime(row.checked_in_at)}</span>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonSecondary}`}
                      disabled={busy}
                      onClick={() => checkOut(row)}
                    >
                      {busy ? "Checking out…" : "Check out"}
                    </button>
                  </>
                )}
                {row && row.checked_out_at && (
                  <span className={styles.pillMuted}>
                    {formatTime(row.checked_in_at)} – {formatTime(row.checked_out_at)}
                  </span>
                )}
                {row && (
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={busy}
                    onClick={() => undo(row)}
                  >
                    Undo
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
