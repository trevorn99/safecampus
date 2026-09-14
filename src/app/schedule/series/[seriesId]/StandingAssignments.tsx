"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { assignToFutureOccurrences, unassignFromFutureOccurrences } from "@/lib/assignAcrossSeries";
import styles from "@/styles/ui.module.css";

type Member = { id: string; name: string; pending: boolean };

export type StandingPosition = {
  id: string;
  title: string;
  slots: number;
  teamName: string | null;
  /** Members eligible for this position — the whole roster, or one team's. */
  candidates: Member[];
  assigned: { assignmentId: string; memberId: string; name: string }[];
};

export function StandingAssignments({
  seriesId,
  positions,
}: {
  seriesId: string;
  positions: StandingPosition[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");

  async function add(templatePositionId: string, memberId: string) {
    if (!memberId) return;
    setPendingId(templatePositionId);
    setError("");
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("template_position_assignments")
      .insert({ series_id: seriesId, template_position_id: templatePositionId, member_id: memberId });
    if (insertError) {
      setPendingId("");
      setError(insertError.message);
      return;
    }

    // The roster row alone only reaches occurrences generated from here on.
    // Events already on the calendar need the assignment written too, or
    // adding someone appears to do nothing until the horizon next advances.
    const { error: fanOutError, skippedFull } = await assignToFutureOccurrences(
      supabase,
      memberId,
      seriesId,
      templatePositionId,
    );
    setPendingId("");
    if (fanOutError) {
      setError(`Added to the regulars, but the upcoming events couldn't be updated: ${fanOutError}`);
      return;
    }
    if (skippedFull > 0) {
      setError(`${skippedFull} upcoming ${skippedFull === 1 ? "occurrence was" : "occurrences were"} already full and were left alone.`);
    }
    router.refresh();
  }

  async function remove(assignmentId: string, templatePositionId: string, memberId: string) {
    setPendingId(assignmentId);
    setError("");
    const supabase = createClient();
    // .select() so the number of rows actually removed comes back. A DELETE
    // that row-level security filters out is not an error — it succeeds
    // having matched nothing — so without this a rejected delete and a
    // successful one are indistinguishable, and the row just sits there.
    const { data: deleted, error: deleteError } = await supabase
      .from("template_position_assignments")
      .delete()
      .eq("id", assignmentId)
      .select("id");
    if (deleteError) {
      setPendingId("");
      setError(deleteError.message);
      return;
    }
    if (!deleted || deleted.length === 0) {
      setPendingId("");
      setError(
        "That didn't remove — you may not have permission on this position. Org admins, and the lead of the position's own team, can change its regulars.",
      );
      return;
    }

    // Symmetric with add(): leaving them on every occurrence already
    // generated would mean removing someone from the roster still had them
    // covering up to a year of shifts.
    const { error: fanOutError } = await unassignFromFutureOccurrences(
      supabase,
      memberId,
      seriesId,
      templatePositionId,
    );
    setPendingId("");
    if (fanOutError) {
      setError(`Removed from the regulars, but the upcoming events couldn't be updated: ${fanOutError}`);
      return;
    }
    router.refresh();
  }

  if (positions.length === 0) {
    return <p className={styles.helperText}>This series has no recurring positions yet.</p>;
  }

  return (
    <>
      <ul className={styles.list}>
        {positions.map((position) => {
          const assignedIds = new Set(position.assigned.map((a) => a.memberId));
          const available = position.candidates.filter((m) => !assignedIds.has(m.id));
          // Only the first `slots` of a roster get placed on each occurrence
          // (see eventSeries.ts), so offering more here would promise
          // something generation won't do.
          const full = position.assigned.length >= position.slots;
          return (
            <li key={position.id} className={styles.listRow}>
              <div>
                <p className={styles.itemName}>{position.title}</p>
                <p className={styles.itemMeta}>
                  {position.teamName ? `${position.teamName} · ` : ""}
                  {position.assigned.length} of {position.slots} filled
                </p>
              </div>
              <div className={styles.tagRow}>
                {position.assigned.map((assignment) => (
                  <span key={assignment.assignmentId} className={styles.tagRow}>
                    <span className={styles.pill}>{assignment.name}</span>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonSecondary}`}
                      disabled={pendingId === assignment.assignmentId}
                      onClick={() => remove(assignment.assignmentId, position.id, assignment.memberId)}
                    >
                      {pendingId === assignment.assignmentId ? "Removing…" : `Remove ${assignment.name}`}
                    </button>
                  </span>
                ))}
                {full ? (
                  <span className={styles.itemMeta}>
                    All {position.slots} {position.slots === 1 ? "slot is" : "slots are"} covered.
                  </span>
                ) : available.length > 0 ? (
                  <select
                    className={styles.select}
                    value=""
                    disabled={pendingId === position.id}
                    onChange={(event) => add(position.id, event.target.value)}
                  >
                    <option value="">Add someone…</option>
                    {available.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                        {member.pending ? " (not yet joined)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={styles.itemMeta}>Everyone eligible is already on this position.</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
