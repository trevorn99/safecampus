"use client";

import { useId, useState } from "react";
import styles from "@/styles/ui.module.css";

// Splits the "YYYY-MM-DDTHH:MM" shape <input type="datetime-local"> used
// into its date and time halves.
function splitValue(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

// A single fused datetime-local control renders wildly differently across
// browsers and forces you to tab through the whole date to reach the time —
// most edits here are "change the time," not the date. Two focused native
// date/time inputs are both more consistent and quicker for that.
//
// Deliberately uncontrolled after mount (seeded once from defaultValue):
// while the time is still unset, onChange reports "" so callers can treat
// an optional end time as unset, but the date the user already picked must
// stay visible rather than getting wiped by a controlled round-trip through
// a blank parent value. To force a reset (e.g. after a successful submit),
// remount with a new `key`.
export function DateTimeField({
  label,
  hint,
  defaultValue,
  onChange,
  required,
}: {
  label: string;
  hint?: string;
  defaultValue: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const id = useId();
  const [{ date, time }, setParts] = useState(() => splitValue(defaultValue));

  function commit(nextDate: string, nextTime: string) {
    setParts({ date: nextDate, time: nextTime });
    onChange(nextDate && nextTime ? `${nextDate}T${nextTime}` : "");
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${id}-date`}>
        {label} {hint && <span className={styles.hint}>{hint}</span>}
      </label>
      <div className={styles.dateTimeRow}>
        <input
          id={`${id}-date`}
          type="date"
          className={styles.input}
          required={required}
          value={date}
          onChange={(event) => commit(event.target.value, time)}
        />
        <input
          id={`${id}-time`}
          type="time"
          aria-label={`${label} — time`}
          className={styles.input}
          required={required}
          value={time}
          onChange={(event) => commit(date, event.target.value)}
        />
      </div>
    </div>
  );
}
