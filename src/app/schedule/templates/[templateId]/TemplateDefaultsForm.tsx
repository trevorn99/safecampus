"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addMinutesToTimeInput, minutesBetweenTimeInputs, toTimeInputValue } from "@/lib/templateTime";
import styles from "@/styles/ui.module.css";

// Editable here as well as at creation, since every template that existed
// before these columns has no defaults on file and would otherwise have no
// way to gain any.
export function TemplateDefaultsForm({
  templateId,
  defaultStartTime,
  defaultDurationMinutes,
  defaultType,
  eventTypes,
}: {
  templateId: string;
  defaultStartTime: string | null;
  defaultDurationMinutes: number | null;
  defaultType: string | null;
  eventTypes: string[];
}) {
  const router = useRouter();
  const initialStart = toTimeInputValue(defaultStartTime);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(
    initialStart && defaultDurationMinutes ? addMinutesToTimeInput(initialStart, defaultDurationMinutes) : "",
  );
  const [type, setType] = useState(defaultType ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    if (startTime && !endTime) {
      setLoading(false);
      setError("Set an end time too — the length is what an event inherits.");
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("event_templates")
      .update({
        default_start_time: startTime || null,
        default_duration_minutes: startTime && endTime ? minutesBetweenTimeInputs(startTime, endTime) : null,
        default_type: type || null,
      })
      .eq("id", templateId);

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="templateDefaultType">
          Event type <span className={styles.hint}>(optional)</span>
        </label>
        <select
          id="templateDefaultType"
          className={styles.select}
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="">No default</option>
          {eventTypes.map((eventType) => (
            <option key={eventType} value={eventType}>
              {eventType}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.tagRow}>
        <input
          type="time"
          className={styles.input}
          aria-label="Usual start time"
          value={startTime}
          onChange={(event) => setStartTime(event.target.value)}
        />
        <span className={styles.itemMeta}>to</span>
        <input
          type="time"
          className={styles.input}
          aria-label="Usual end time"
          value={endTime}
          onChange={(event) => setEndTime(event.target.value)}
        />
        <button type="submit" className={`${styles.button} ${styles.buttonSecondary}`} disabled={loading}>
          {loading ? "Saving…" : "Save defaults"}
        </button>
      </div>
      {saved && <p className={styles.helperText}>Saved.</p>}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
