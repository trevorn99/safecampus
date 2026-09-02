"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };

export function AddSeriesPositionForm({
  seriesId,
  seriesTitle,
  templateId,
  organizationId,
  teams,
  locations,
}: {
  seriesId: string;
  seriesTitle: string;
  templateId: string | null;
  organizationId: string;
  teams: Option[];
  locations: Option[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [teamId, setTeamId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [startOffset, setStartOffset] = useState("0");
  const [endOffset, setEndOffset] = useState("");
  const [slots, setSlots] = useState("1");
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    try {
      // A series created without any positions has no template to hang
      // this one off of yet — create one and link it, same as
      // NewEventForm does when positions are added to a repeating event.
      let effectiveTemplateId = templateId;
      if (!effectiveTemplateId) {
        const { data: newTemplate, error: templateError } = await supabase
          .from("event_templates")
          .insert({ organization_id: organizationId, name: `${seriesTitle} positions` })
          .select("id")
          .single();
        if (templateError) throw new Error(templateError.message);
        effectiveTemplateId = newTemplate.id;

        const { error: linkError } = await supabase
          .from("event_series")
          .update({ template_id: effectiveTemplateId })
          .eq("id", seriesId);
        if (linkError) throw new Error(linkError.message);
      }

      const { data: templatePosition, error: templatePositionError } = await supabase
        .from("template_positions")
        .insert({
          template_id: effectiveTemplateId,
          title,
          team_id: teamId || null,
          location_id: locationId || null,
          start_offset_minutes: Number(startOffset),
          end_offset_minutes: endOffset ? Number(endOffset) : null,
          slots: Number(slots),
        })
        .select("id")
        .single();
      if (templatePositionError) throw new Error(templatePositionError.message);

      if (applyToExisting) {
        const { data: futureEvents } = await supabase
          .from("events")
          .select("id, start_time")
          .eq("series_id", seriesId)
          .gte("start_time", new Date().toISOString());

        if (futureEvents && futureEvents.length > 0) {
          const rows = futureEvents.map((futureEvent) => {
            const startMs = new Date(futureEvent.start_time).getTime();
            return {
              event_id: futureEvent.id,
              template_position_id: templatePosition.id,
              title,
              team_id: teamId || null,
              location_id: locationId || null,
              start_time: new Date(startMs + Number(startOffset) * 60_000).toISOString(),
              end_time: endOffset ? new Date(startMs + Number(endOffset) * 60_000).toISOString() : null,
              slots: Number(slots),
            };
          });
          const { error: positionsError } = await supabase.from("event_positions").insert(rows);
          if (positionsError) {
            throw new Error(`Position added to the series, but existing events failed to update: ${positionsError.message}`);
          }
        }
      }

      setTitle("");
      setTeamId("");
      setLocationId("");
      setStartOffset("0");
      setEndOffset("");
      setSlots("1");
      setLoading(false);
      router.refresh();
    } catch (submitError) {
      setLoading(false);
      setError(submitError instanceof Error ? submitError.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="seriesPositionTitle">
          Position
        </label>
        <input
          id="seriesPositionTitle"
          className={styles.input}
          required
          placeholder="Main Entrance"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="seriesPositionTeam">
          Team <span className={styles.hint}>(optional)</span>
        </label>
        <select
          id="seriesPositionTeam"
          className={styles.select}
          value={teamId}
          onChange={(event) => setTeamId(event.target.value)}
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
        <label className={styles.label} htmlFor="seriesPositionLocation">
          Location <span className={styles.hint}>(optional — uses each event&apos;s location if left blank)</span>
        </label>
        <select
          id="seriesPositionLocation"
          className={styles.select}
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
        >
          <option value="">Same as event</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="seriesPositionStartOffset">
          Starts <span className={styles.hint}>minutes relative to each event&apos;s start (0 = same time, -30 = 30 min early)</span>
        </label>
        <input
          id="seriesPositionStartOffset"
          type="number"
          className={styles.input}
          required
          value={startOffset}
          onChange={(event) => setStartOffset(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="seriesPositionEndOffset">
          Ends <span className={styles.hint}>minutes relative to each event&apos;s start (optional)</span>
        </label>
        <input
          id="seriesPositionEndOffset"
          type="number"
          className={styles.input}
          value={endOffset}
          onChange={(event) => setEndOffset(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="seriesPositionSlots">
          People needed
        </label>
        <input
          id="seriesPositionSlots"
          type="number"
          min={1}
          className={styles.input}
          required
          value={slots}
          onChange={(event) => setSlots(event.target.value)}
        />
      </div>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={applyToExisting}
          onChange={(event) => setApplyToExisting(event.target.checked)}
        />
        Also add this position to already-generated upcoming events
      </label>

      <div className={styles.actions}>
        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
          {loading ? "Adding…" : "Add position"}
        </button>
      </div>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </form>
  );
}
