"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };
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

function emptyRow(): PositionRow {
  return { key: crypto.randomUUID(), title: "", teamId: "", startOffset: "0", endOffset: "", slots: "1" };
}

export function NewEventForm({
  organizationId,
  locations,
  teams,
  templates,
  templatePositions,
}: {
  organizationId: string;
  locations: Option[];
  teams: Option[];
  templates: Option[];
  templatePositions: TemplatePosition[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("service");
  const [locationId, setLocationId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
  }

  function updateRow(key: string, patch: Partial<PositionRow>) {
    setPositions((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setPositions((prev) => prev.filter((row) => row.key !== key));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saveAsTemplate && !templateName.trim()) {
      setError("Name the template you're saving, or uncheck \"save as template.\"");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const startTimeIso = new Date(startTime).toISOString();

    let newTemplateId: string | null = null;
    if (saveAsTemplate && positions.length > 0) {
      const { data: newTemplate, error: templateError } = await supabase
        .from("event_templates")
        .insert({ organization_id: organizationId, name: templateName.trim() })
        .select("id")
        .single();
      if (templateError) {
        setLoading(false);
        setError(templateError.message);
        return;
      }
      newTemplateId = newTemplate.id;

      const { error: templatePositionsError } = await supabase.from("template_positions").insert(
        positions.map((row) => ({
          template_id: newTemplateId,
          title: row.title,
          team_id: row.teamId || null,
          start_offset_minutes: Number(row.startOffset),
          end_offset_minutes: row.endOffset ? Number(row.endOffset) : null,
          slots: Number(row.slots),
        })),
      );
      if (templatePositionsError) {
        setLoading(false);
        setError(`Template created, but its positions failed to save: ${templatePositionsError.message}`);
        return;
      }
    }

    const { data: createdEvent, error: eventError } = await supabase
      .from("events")
      .insert({
        organization_id: organizationId,
        location_id: locationId || null,
        title,
        type,
        start_time: startTimeIso,
        template_id: newTemplateId ?? templateId ?? null,
      })
      .select("id")
      .single();

    if (eventError) {
      setLoading(false);
      setError(eventError.message);
      return;
    }

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
        setLoading(false);
        setError(`Event created, but its positions failed to save: ${positionsError.message}`);
        return;
      }
    }

    setLoading(false);
    router.push(`/schedule/${createdEvent.id}`);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h1 className={styles.cardTitle}>New event</h1>
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
            Type
          </label>
          <select id="eventType" className={styles.select} value={type} onChange={(event) => setType(event.target.value)}>
            <option value="service">Service</option>
            <option value="drill">Drill</option>
            <option value="meeting">Meeting</option>
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
        <div className={styles.field}>
          <label className={styles.label} htmlFor="eventStart">
            Start time
          </label>
          <input
            id="eventStart"
            type="datetime-local"
            className={styles.input}
            required
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </div>
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
            <div key={row.key} className={styles.tagRow}>
              <input
                className={styles.input}
                placeholder="Position title"
                required
                value={row.title}
                onChange={(event) => updateRow(row.key, { title: event.target.value })}
              />
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
              <input
                type="number"
                className={styles.input}
                title="Start offset (minutes from event start)"
                value={row.startOffset}
                onChange={(event) => updateRow(row.key, { startOffset: event.target.value })}
              />
              <input
                type="number"
                className={styles.input}
                title="End offset (minutes from event start, optional)"
                placeholder="end (min)"
                value={row.endOffset}
                onChange={(event) => updateRow(row.key, { endOffset: event.target.value })}
              />
              <input
                type="number"
                min={1}
                className={styles.input}
                title="People needed"
                value={row.slots}
                onChange={(event) => updateRow(row.key, { slots: event.target.value })}
              />
              <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => removeRow(row.key)}>
                Remove
              </button>
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

        {positions.length > 0 && (
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
                placeholder="Template name"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
              />
            )}
          </div>
        )}

        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
            {loading ? "Creating…" : "Create event"}
          </button>
        </div>
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </form>
    </div>
  );
}
