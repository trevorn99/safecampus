"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };

export function NewEventForm({
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
  const [type, setType] = useState("service");
  const [locationId, setLocationId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const startTimeIso = new Date(startTime).toISOString();

    const { data: createdEvent, error: eventError } = await supabase
      .from("events")
      .insert({
        organization_id: organizationId,
        location_id: locationId || null,
        title,
        type,
        start_time: startTimeIso,
      })
      .select("id")
      .single();

    if (eventError) {
      setLoading(false);
      setError(eventError.message);
      return;
    }

    if (templateId) {
      const { data: templatePositions, error: templateError } = await supabase
        .from("template_positions")
        .select("team_id, title, location_id, start_offset_minutes, end_offset_minutes, slots")
        .eq("template_id", templateId);

      if (templateError) {
        setLoading(false);
        setError(`Event created, but couldn't load the template: ${templateError.message}`);
        return;
      }

      const startMs = new Date(startTimeIso).getTime();
      const positions = (templatePositions ?? []).map((tp) => ({
        event_id: createdEvent.id,
        team_id: tp.team_id,
        title: tp.title,
        location_id: tp.location_id,
        start_time: new Date(startMs + tp.start_offset_minutes * 60_000).toISOString(),
        end_time:
          tp.end_offset_minutes != null
            ? new Date(startMs + tp.end_offset_minutes * 60_000).toISOString()
            : null,
        slots: tp.slots,
      }));

      if (positions.length > 0) {
        const { error: positionsError } = await supabase.from("event_positions").insert(positions);
        if (positionsError) {
          setLoading(false);
          setError(`Event created, but couldn't create positions from the template: ${positionsError.message}`);
          return;
        }
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
              Build positions from a template <span className={styles.hint}>(optional)</span>
            </label>
            <select
              id="eventTemplate"
              className={styles.select}
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="">No template — add positions manually</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
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
