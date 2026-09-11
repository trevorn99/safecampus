"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { minutesBetweenTimeInputs } from "@/lib/templateTime";
import styles from "@/styles/ui.module.css";

export function NewTemplateForm({
  organizationId,
  eventTypes,
}: {
  organizationId: string;
  eventTypes: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.from("event_templates").insert({
      organization_id: organizationId,
      name,
      description: description || null,
      default_type: type || null,
      default_start_time: startTime || null,
      // Both or neither: a length with no start to hang it off can't fill
      // anything in.
      default_duration_minutes:
        startTime && endTime ? minutesBetweenTimeInputs(startTime, endTime) : null,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setDescription("");
    setStartTime("");
    setEndTime("");
    setType("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => setOpen(true)}>
          + New template
        </button>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>New template</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="templateName">
            Name
          </label>
          <input
            id="templateName"
            className={styles.input}
            required
            placeholder="Sunday Service"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="templateDescription">
            Description <span className={styles.hint}>(optional)</span>
          </label>
          <input
            id="templateDescription"
            className={styles.input}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="templateType">
            Event type <span className={styles.hint}>(optional)</span>
          </label>
          <select
            id="templateType"
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
        <div className={styles.field}>
          <label className={styles.label} htmlFor="templateStart">
            Usual time <span className={styles.hint}>(optional — pre-fills an event created from this template)</span>
          </label>
          <div className={styles.tagRow}>
            <input
              id="templateStart"
              type="time"
              className={styles.input}
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
          </div>
        </div>
        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
            {loading ? "Saving…" : "Save template"}
          </button>
          <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </form>
    </div>
  );
}
