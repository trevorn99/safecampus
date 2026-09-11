"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { WEEKDAYS, ORDINALS, buildWeeklyRule, buildMonthlyRule } from "@/lib/recurrence";
import { zonedWallTimeToUtc } from "@/lib/timezone";
import { DateTimeField } from "@/components/DateTimeField";
import {
  addMinutesToTimeInput,
  minutesBetweenTimeInputs,
  toTimeInputValue,
  todayDateInput,
  withTime,
} from "@/lib/templateTime";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };
type TemplateOption = Option & {
  default_start_time: string | null;
  default_duration_minutes: number | null;
};
type LocationOption = { id: string; name: string; timezone: string | null };

function fromZonedInputValue(value: string, timeZone: string): Date {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return zonedWallTimeToUtc({ year, month, day, hour, minute, second: 0 }, timeZone);
}

type TemplatePosition = {
  id: string;
  template_id: string;
  team_id: string | null;
  title: string;
  location_id: string | null;
  start_offset_minutes: number;
  end_offset_minutes: number | null;
  slots: number;
};
type PositionRow = {
  key: string;
  title: string;
  teamId: string;
  startOffset: string;
  endOffset: string;
  slots: string;
};
type Repeats = "never" | "weekly" | "monthly";

// Order-independent fingerprint of a set of positions, used to tell "this
// event still uses the template I picked" from "I picked a template and then
// changed the positions". Rows can be added and removed but not reordered,
// so sorting is enough to make the comparison stable.
function positionsSignature(
  rows: { title: string; teamId: string; startOffset: string; endOffset: string; slots: string }[],
): string {
  return rows
    .map((row) => `${row.title}|${row.teamId}|${row.startOffset}|${row.endOffset}|${row.slots}`)
    .sort()
    .join(";");
}

function emptyRow(): PositionRow {
  return { key: crypto.randomUUID(), title: "", teamId: "", startOffset: "0", endOffset: "", slots: "1" };
}

export function NewEventForm({
  organizationId,
  eventTypes,
  locations,
  orgTimeZone,
  teams,
  templates,
  templatePositions,
  pcoCandidate,
  defaultDate,
}: {
  organizationId: string;
  eventTypes: string[];
  locations: LocationOption[];
  orgTimeZone: string;
  teams: Option[];
  templates: TemplateOption[];
  templatePositions: TemplatePosition[];
  pcoCandidate?: { id: string; title: string; startTime: string; endTime: string } | null;
  defaultDate?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(pcoCandidate?.title ?? "");
  const [type, setType] = useState(eventTypes[0] ?? "");
  const [locationId, setLocationId] = useState("");
  const [startTime, setStartTime] = useState(pcoCandidate?.startTime ?? (defaultDate ? `${defaultDate}T09:00` : ""));
  const [endTime, setEndTime] = useState(pcoCandidate?.endTime ?? "");
  const timeZone = locations.find((l) => l.id === locationId)?.timezone || orgTimeZone;
  const [templateId, setTemplateId] = useState("");
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [repeats, setRepeats] = useState<Repeats>("never");
  const [interval, setInterval] = useState("1");
  const [weekDays, setWeekDays] = useState<string[]>([]);
  const [ordinal, setOrdinal] = useState("1");
  const [monthDay, setMonthDay] = useState("SU");

  function toggleWeekDay(day: string) {
    setWeekDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function handleTemplateChange(nextTemplateId: string) {
    setTemplateId(nextTemplateId);
    if (!nextTemplateId) return;
    const rows = templatePositions
      .filter((tp) => tp.template_id === nextTemplateId)
      .map((tp) => ({
        key: crypto.randomUUID(),
        title: tp.title,
        teamId: tp.team_id ?? "",
        startOffset: String(tp.start_offset_minutes),
        endOffset: tp.end_offset_minutes != null ? String(tp.end_offset_minutes) : "",
        slots: String(tp.slots),
      }));
    setPositions(rows);

    // A template's usual time fills the event's start and end, keeping
    // whatever date is already chosen — the date comes from the calendar or
    // the ?date= param, the template only ever supplies the time of day.
    // Position offsets below are measured from this start, so they only line
    // up if the event actually begins when the template says it does.
    const template = templates.find((t) => t.id === nextTemplateId);
    const templateStart = toTimeInputValue(template?.default_start_time);
    if (templateStart) {
      const fallbackDate = defaultDate ?? todayDateInput();
      const nextStart = withTime(startTime, templateStart, fallbackDate);
      setStartTime(nextStart);
      if (template?.default_duration_minutes) {
        setEndTime(withTime(nextStart, addMinutesToTimeInput(templateStart, template.default_duration_minutes), fallbackDate));
      }
    }
  }

  function updateRow(key: string, patch: Partial<PositionRow>) {
    setPositions((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setPositions((prev) => prev.filter((row) => row.key !== key));
  }

  // Whenever this event repeats, positions can only carry forward to future
  // occurrences via a template — so a name is required (no "save?" checkbox
  // needed, unlike the one-off case where saving one is optional).
  // The positions as the selected template defines them, in the same shape
  // the form holds them, so the two can be compared.
  const selectedTemplateRows = templatePositions
    .filter((tp) => tp.template_id === templateId)
    .map((tp) => ({
      title: tp.title,
      teamId: tp.team_id ?? "",
      startOffset: String(tp.start_offset_minutes),
      endOffset: tp.end_offset_minutes != null ? String(tp.end_offset_minutes) : "",
      slots: String(tp.slots),
    }));

  // Picking a template copies its rows into `positions`, and a repeating
  // event then needs *a* template to generate from — but it already has one.
  // Without this check every repeating event created from a template built a
  // duplicate of that template and used the copy, so the list filled up with
  // identical templates and edits to the original stopped affecting anything.
  const reusesSelectedTemplate =
    Boolean(templateId) && positionsSignature(positions) === positionsSignature(selectedTemplateRows);

  // A name is only wanted when a template is actually about to be created.
  const needsTemplateName = repeats !== "never" && positions.length > 0 && !reusesSelectedTemplate;

  // Naming the template is the one bit of bookkeeping a repeating event
  // forces on you, and inventing a second name for the same thing is busywork
  // — so it falls back to the event's own title. Only the name is optional;
  // the template itself isn't, since without one only the first occurrence
  // would get positions.
  const resolvedTemplateName = templateName.trim() || title.trim();

  async function createTemplateFromPositions(name: string): Promise<string | null> {
    const supabase = createClient();
    // Carries the event's own time onto the template it spawns, so the next
    // event created from it starts out already scheduled.
    const [, startClock] = startTime.split("T");
    const [, endClock] = endTime ? endTime.split("T") : [null, null];

    const { data: newTemplate, error: templateError } = await supabase
      .from("event_templates")
      .insert({
        organization_id: organizationId,
        name,
        default_start_time: startClock || null,
        default_duration_minutes:
          startClock && endClock ? minutesBetweenTimeInputs(startClock, endClock) : null,
      })
      .select("id")
      .single();
    if (templateError) throw new Error(templateError.message);

    const { error: templatePositionsError } = await supabase.from("template_positions").insert(
      positions.map((row) => ({
        template_id: newTemplate.id,
        title: row.title,
        team_id: row.teamId || null,
        start_offset_minutes: Number(row.startOffset),
        end_offset_minutes: row.endOffset ? Number(row.endOffset) : null,
        slots: Number(row.slots),
      })),
    );
    if (templatePositionsError) {
      throw new Error(`Template created, but its positions failed to save: ${templatePositionsError.message}`);
    }
    return newTemplate.id;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (repeats === "weekly" && weekDays.length === 0) {
      setError("Pick at least one day of the week.");
      return;
    }
    if ((repeats === "never" && saveAsTemplate) || needsTemplateName) {
      if (!resolvedTemplateName) {
        setError("Give the event a title — the positions template is named after it.");
        return;
      }
    }
    if (repeats !== "never" && !endTime) {
      setError("Set an end time — it's what gives every occurrence its length.");
      return;
    }
    if (endTime && new Date(endTime) <= new Date(startTime)) {
      setError("End time must be after the start time.");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const startTimeIso = fromZonedInputValue(startTime, timeZone).toISOString();
    const endTimeIso = endTime ? fromZonedInputValue(endTime, timeZone).toISOString() : null;

    try {
      let newTemplateId: string | null = null;
      if (
        positions.length > 0 &&
        !reusesSelectedTemplate &&
        (needsTemplateName || (repeats === "never" && saveAsTemplate))
      ) {
        newTemplateId = await createTemplateFromPositions(resolvedTemplateName);
      }
      // templateId defaults to "" (not null) when nothing's selected — ??
      // only skips null/undefined, so it wouldn't catch that empty string.
      const effectiveTemplateId = newTemplateId || templateId || null;

      if (repeats === "never") {
        const { data: createdEvent, error: eventError } = await supabase
          .from("events")
          .insert({
            organization_id: organizationId,
            location_id: locationId || null,
            title,
            type,
            start_time: startTimeIso,
            end_time: endTimeIso,
            template_id: effectiveTemplateId,
          })
          .select("id")
          .single();
        if (eventError) throw new Error(eventError.message);

        if (positions.length > 0) {
          const startMs = new Date(startTimeIso).getTime();
          const { error: positionsError } = await supabase.from("event_positions").insert(
            positions.map((row) => ({
              event_id: createdEvent.id,
              title: row.title,
              team_id: row.teamId || null,
              start_time: new Date(startMs + Number(row.startOffset) * 60_000).toISOString(),
              end_time: row.endOffset ? new Date(startMs + Number(row.endOffset) * 60_000).toISOString() : null,
              slots: Number(row.slots),
            })),
          );
          if (positionsError) {
            throw new Error(`Event created, but its positions failed to save: ${positionsError.message}`);
          }
        }

        if (pcoCandidate) {
          await supabase
            .from("pco_imported_events")
            .update({ promoted_event_id: createdEvent.id })
            .eq("id", pcoCandidate.id);
        }

        setLoading(false);
        router.push(`/schedule/${createdEvent.id}`);
        return;
      }

      const recurrenceRule =
        repeats === "weekly" ? buildWeeklyRule(Number(interval), weekDays) : buildMonthlyRule(ordinal, monthDay);

      const { data: series, error: seriesError } = await supabase
        .from("event_series")
        .insert({
          organization_id: organizationId,
          location_id: locationId || null,
          template_id: effectiveTemplateId,
          title,
          type,
          recurrence_rule: recurrenceRule,
          first_occurrence_at: startTimeIso,
          duration_minutes: Math.round(
            (new Date(endTimeIso!).getTime() - new Date(startTimeIso).getTime()) / 60_000,
          ),
        })
        .select("id")
        .single();
      if (seriesError) throw new Error(seriesError.message);

      await fetch("/api/schedule/series/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId: series.id }),
      }).catch(() => {});

      setLoading(false);
      router.push(`/schedule/series/${series.id}`);
    } catch (submitError) {
      setLoading(false);
      setError(submitError instanceof Error ? submitError.message : "Something went wrong");
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h1 className={styles.cardTitle}>New event</h1>
        {pcoCandidate && (
          <p className={styles.helperText}>Creating from a Planning Center calendar event — edit anything below.</p>
        )}
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="eventTitle">
            Title
          </label>
          <input
            id="eventTitle"
            className={styles.input}
            required
            placeholder="Sunday Service"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="eventType">
            Type <span className={styles.hint}>(<Link href="/schedule/event-types" className={styles.link}>manage types</Link>)</span>
          </label>
          <select id="eventType" className={styles.select} value={type} onChange={(event) => setType(event.target.value)}>
            {eventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="eventLocation">
            Location <span className={styles.hint}>(optional — org-wide if left blank)</span>
          </label>
          <select
            id="eventLocation"
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
        <DateTimeField
          label={repeats === "never" ? "Start time" : "First occurrence"}
          defaultValue={startTime}
          onChange={setStartTime}
          required
        />

        <DateTimeField
          label="End time"
          hint={repeats === "never" ? "(optional)" : "sets how long every occurrence runs"}
          defaultValue={endTime}
          onChange={setEndTime}
          required={repeats !== "never"}
        />

        <div className={styles.field}>
          <label className={styles.label} htmlFor="repeats">
            Repeats
          </label>
          <select
            id="repeats"
            className={styles.select}
            value={repeats}
            onChange={(event) => setRepeats(event.target.value as Repeats)}
          >
            <option value="never">Never — one-time event</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {repeats !== "never" && (
          <>
            {repeats === "weekly" && (
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
          </>
        )}

        {templates.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="eventTemplate">
              Start from a template <span className={styles.hint}>(optional — pre-fills positions below, editable)</span>
            </label>
            <select
              id="eventTemplate"
              className={styles.select}
              value={templateId}
              onChange={(event) => handleTemplateChange(event.target.value)}
            >
              <option value="">No template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>Positions</label>
          {positions.length === 0 && (
            <p className={styles.hint}>No positions yet — add one below, or pick a template above.</p>
          )}
          {positions.map((row) => (
            <div key={row.key} className={styles.card}>
              <div className={styles.tagRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Position</label>
                  <input
                    className={styles.input}
                    placeholder="Main Entrance"
                    required
                    value={row.title}
                    onChange={(event) => updateRow(row.key, { title: event.target.value })}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Team</label>
                  <select
                    className={styles.select}
                    value={row.teamId}
                    onChange={(event) => updateRow(row.key, { teamId: event.target.value })}
                  >
                    <option value="">Any team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Starts <span className={styles.hint}>min. from event start — negative for before, e.g. -15</span>
                  </label>
                  <input
                    type="number"
                    className={styles.input}
                    value={row.startOffset}
                    onChange={(event) => updateRow(row.key, { startOffset: event.target.value })}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Ends <span className={styles.hint}>min. from event start, optional</span>
                  </label>
                  <input
                    type="number"
                    className={styles.input}
                    placeholder="No set end"
                    value={row.endOffset}
                    onChange={(event) => updateRow(row.key, { endOffset: event.target.value })}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>People needed</label>
                  <input
                    type="number"
                    min={1}
                    className={styles.input}
                    value={row.slots}
                    onChange={(event) => updateRow(row.key, { slots: event.target.value })}
                  />
                </div>
              </div>
              <div className={styles.actions}>
                <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => removeRow(row.key)}>
                  Remove position
                </button>
              </div>
            </div>
          ))}
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={() => setPositions((prev) => [...prev, emptyRow()])}
            >
              + Add position
            </button>
          </div>
        </div>

        {positions.length > 0 && repeats === "never" && (
          <div className={styles.field}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(event) => setSaveAsTemplate(event.target.checked)}
              />
              Save these positions as a reusable template
            </label>
            {saveAsTemplate && (
              <input
                className={styles.input}
                placeholder={title.trim() || "Template name"}
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
              />
            )}
          </div>
        )}

        {repeats !== "never" && positions.length > 0 && reusesSelectedTemplate && (
          <p className={styles.hint}>
            Using the “{templates.find((t) => t.id === templateId)?.name ?? "selected"}” template — every occurrence
            gets these positions from it. Editing the positions above instead saves a new template for this series,
            leaving the original alone.
          </p>
        )}

        {needsTemplateName && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="seriesTemplateName">
              Template name <span className={styles.hint}>(optional)</span>
            </label>
            <input
              id="seriesTemplateName"
              className={styles.input}
              placeholder={title.trim() || "Template name"}
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
            <p className={styles.hint}>
              Your positions are saved as a template so every occurrence gets them — future events can reuse it
              too. Left blank it takes the event&apos;s title, {title.trim() ? `“${title.trim()}”` : "once you add one"}.
            </p>
          </div>
        )}

        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
            {loading ? "Creating…" : repeats === "never" ? "Create event" : "Create series"}
          </button>
        </div>
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </form>
    </div>
  );
}
