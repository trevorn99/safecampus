"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WEEKDAYS, ORDINALS, buildWeeklyRule, buildMonthlyRule } from "@/lib/recurrence";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };

export function NewSeriesForm({
  organizationId,
  locations,
  templates,
}: {
  organizationId: string;
  locations: Option[];
  templates: Option[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [locationId, setLocationId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [firstOccurrence, setFirstOccurrence] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("weekly");
  const [interval, setInterval] = useState("1");
  const [weekDays, setWeekDays] = useState<string[]>([]);
  const [ordinal, setOrdinal] = useState("1");
  const [monthDay, setMonthDay] = useState("SU");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleWeekDay(day: string) {
    setWeekDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (frequency === "weekly" && weekDays.length === 0) {
      setError("Pick at least one day of the week.");
      return;
    }

    setLoading(true);
    setError("");

    const recurrenceRule =
      frequency === "weekly" ? buildWeeklyRule(Number(interval), weekDays) : buildMonthlyRule(ordinal, monthDay);

    const supabase = createClient();
    const { data: series, error: seriesError } = await supabase
      .from("event_series")
      .insert({
        organization_id: organizationId,
        location_id: locationId || null,
        template_id: templateId || null,
        title,
        recurrence_rule: recurrenceRule,
        first_occurrence_at: new Date(firstOccurrence).toISOString(),
        duration_minutes: Number(durationMinutes),
      })
      .select("id")
      .single();

    if (seriesError) {
      setLoading(false);
      setError(seriesError.message);
      return;
    }

    // Best-effort: generate whatever occurrences are already due so the
    // admin sees results immediately rather than waiting for tomorrow's
    // cron run. If this fails, the series still exists — the daily job
    // will pick it up.
    await fetch("/api/schedule/series/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId: series.id }),
    }).catch(() => {});

    setLoading(false);
    router.push(`/schedule/series/${series.id}`);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h1 className={styles.cardTitle}>New recurring series</h1>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="seriesTitle">
            Title
          </label>
          <input
            id="seriesTitle"
            className={styles.input}
            required
            placeholder="Sunday Service"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="seriesLocation">
            Location <span className={styles.hint}>(optional — org-wide if left blank)</span>
          </label>
          <select
            id="seriesLocation"
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
        {templates.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="seriesTemplate">
              Position template <span className={styles.hint}>(optional)</span>
            </label>
            <select
              id="seriesTemplate"
              className={styles.select}
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="">No template — add positions manually per event</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="firstOccurrence">
            First occurrence
          </label>
          <input
            id="firstOccurrence"
            type="datetime-local"
            className={styles.input}
            required
            value={firstOccurrence}
            onChange={(event) => setFirstOccurrence(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="durationMinutes">
            Duration <span className={styles.hint}>minutes (informational)</span>
          </label>
          <input
            id="durationMinutes"
            type="number"
            min={1}
            className={styles.input}
            required
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="frequency">
            Repeats
          </label>
          <select
            id="frequency"
            className={styles.select}
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as "weekly" | "monthly")}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {frequency === "weekly" && (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="interval">
                Every <span className={styles.hint}>weeks</span>
              </label>
              <input
                id="interval"
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

        {frequency === "monthly" && (
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

        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
            {loading ? "Creating…" : "Create series"}
          </button>
        </div>
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </form>
    </div>
  );
}
