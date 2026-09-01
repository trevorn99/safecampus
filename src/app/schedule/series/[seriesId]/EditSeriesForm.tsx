"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WEEKDAYS, ORDINALS, buildWeeklyRule, buildMonthlyRule, parseRecurrenceRule } from "@/lib/recurrence";
import { DateTimeField } from "@/components/DateTimeField";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };
type Repeats = "weekly" | "monthly";

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EditSeriesForm({
  series,
  eventTypes,
  locations,
  onDone,
}: {
  series: {
    id: string;
    title: string;
    type: string;
    location_id: string | null;
    first_occurrence_at: string;
    duration_minutes: number;
    recurrence_rule: string;
  };
  eventTypes: string[];
  locations: Option[];
  onDone: () => void;
}) {
  const router = useRouter();
  const parsed = parseRecurrenceRule(series.recurrence_rule);

  const [title, setTitle] = useState(series.title);
  const [type, setType] = useState(series.type);
  const [locationId, setLocationId] = useState(series.location_id ?? "");
  const [firstOccurrence, setFirstOccurrence] = useState(toLocalInputValue(series.first_occurrence_at));
  const [durationMinutes, setDurationMinutes] = useState(String(series.duration_minutes));
  const [repeats, setRepeats] = useState<Repeats>(parsed?.freq === "MONTHLY" ? "monthly" : "weekly");
  const [interval, setInterval] = useState(String(parsed?.freq === "WEEKLY" ? parsed.interval : 1));
  const [weekDays, setWeekDays] = useState<string[]>(parsed?.freq === "WEEKLY" ? parsed.days : []);
  const [ordinal, setOrdinal] = useState(parsed?.freq === "MONTHLY" ? parsed.ordinal : "1");
  const [monthDay, setMonthDay] = useState(parsed?.freq === "MONTHLY" ? parsed.day : "SU");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleWeekDay(day: string) {
    setWeekDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (repeats === "weekly" && weekDays.length === 0) {
      setError("Pick at least one day of the week.");
      return;
    }

    setLoading(true);

    const recurrenceRule =
      repeats === "weekly" ? buildWeeklyRule(Number(interval), weekDays) : buildMonthlyRule(ordinal, monthDay);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("event_series")
      .update({
        title,
        type,
        location_id: locationId || null,
        first_occurrence_at: new Date(firstOccurrence).toISOString(),
        duration_minutes: Number(durationMinutes),
        recurrence_rule: recurrenceRule,
      })
      .eq("id", series.id);

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="editSeriesTitle">
          Title
        </label>
        <input
          id="editSeriesTitle"
          className={styles.input}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="editSeriesType">
          Type
        </label>
        <select
          id="editSeriesType"
          className={styles.select}
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {eventTypes.map((eventType) => (
            <option key={eventType} value={eventType}>
              {eventType}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="editSeriesLocation">
          Location <span className={styles.hint}>(optional — org-wide if left blank)</span>
        </label>
        <select
          id="editSeriesLocation"
          className={styles.select}
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
        >
          <option value="">Org-wide</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </div>
      <DateTimeField label="First occurrence" defaultValue={firstOccurrence} onChange={setFirstOccurrence} required />
      <div className={styles.field}>
        <label className={styles.label} htmlFor="editSeriesDuration">
          Duration <span className={styles.hint}>minutes — sets each occurrence&apos;s end time</span>
        </label>
        <input
          id="editSeriesDuration"
          type="number"
          min={1}
          className={styles.input}
          required
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="editSeriesRepeats">
          Repeats
        </label>
        <select
          id="editSeriesRepeats"
          className={styles.select}
          value={repeats}
          onChange={(event) => setRepeats(event.target.value as Repeats)}
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {repeats === "weekly" && (
        <>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="editSeriesInterval">
              Every <span className={styles.hint}>weeks</span>
            </label>
            <input
              id="editSeriesInterval"
              type="number"
              min={1}
              className={styles.input}
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>On these days</label>
            <div className={styles.tagRow}>
              {WEEKDAYS.map((day) => (
                <button
                  type="button"
                  key={day.value}
                  className={weekDays.includes(day.value) ? styles.pill : styles.pillMuted}
                  onClick={() => toggleWeekDay(day.value)}
                >
                  {day.label.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {repeats === "monthly" && (
        <div className={styles.field}>
          <label className={styles.label}>On the</label>
          <div className={styles.tagRow}>
            <select className={styles.select} value={ordinal} onChange={(event) => setOrdinal(event.target.value)}>
              {ORDINALS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className={styles.select} value={monthDay} onChange={(event) => setMonthDay(event.target.value)}>
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <p className={styles.hint}>
        Changes apply to newly generated occurrences. Events already generated for future dates keep their current
        title, time, and location — edit those individually if needed.
      </p>

      <div className={styles.actions}>
        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
          {loading ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={onDone}>
          Cancel
        </button>
      </div>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </form>
  );
}
