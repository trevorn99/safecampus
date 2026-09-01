"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { utcToZonedWallTime, zonedWallTimeToUtc } from "@/lib/timezone";
import { DateTimeField } from "@/components/DateTimeField";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };

// Position times are wall-clock times in the event's location/org timezone
// (see src/lib/eventSeries.ts), not the admin's browser timezone.
function toZonedInputValue(iso: string | null, timeZone: string) {
  if (!iso) return "";
  const wall = utcToZonedWallTime(new Date(iso), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

function fromZonedInputValue(value: string, timeZone: string): Date {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return zonedWallTimeToUtc({ year, month, day, hour, minute, second: 0 }, timeZone);
}

export function EditPositionForm({
  position,
  teams,
  locations,
  seriesId,
  timeZone,
  onDone,
}: {
  position: {
    id: string;
    title: string;
    team_id: string | null;
    location_id: string | null;
    start_time: string;
    end_time: string | null;
    slots: number;
    template_position_id: string | null;
  };
  teams: Option[];
  locations: Option[];
  seriesId: string | null;
  timeZone: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(position.title);
  const [teamId, setTeamId] = useState(position.team_id ?? "");
  const [locationId, setLocationId] = useState(position.location_id ?? "");
  const [startTime, setStartTime] = useState(toZonedInputValue(position.start_time, timeZone));
  const [endTime, setEndTime] = useState(toZonedInputValue(position.end_time, timeZone));
  const [slots, setSlots] = useState(String(position.slots));
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canApplyToSeries = Boolean(position.template_position_id && seriesId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (endTime && new Date(endTime) <= new Date(startTime)) {
      setError("End time must be after the start time.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const shared = {
      title,
      team_id: teamId || null,
      location_id: locationId || null,
      slots: Number(slots),
    };

    const { error: updateError } = await supabase
      .from("event_positions")
      .update({
        ...shared,
        start_time: fromZonedInputValue(startTime, timeZone).toISOString(),
        end_time: endTime ? fromZonedInputValue(endTime, timeZone).toISOString() : null,
      })
      .eq("id", position.id);

    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    if (applyToSeries && canApplyToSeries) {
      const { data: seriesEvents } = await supabase.from("events").select("id").eq("series_id", seriesId);
      const eventIds = (seriesEvents ?? []).map((e) => e.id);
      if (eventIds.length > 0) {
        await supabase
          .from("event_positions")
          .update(shared)
          .eq("template_position_id", position.template_position_id)
          .in("event_id", eventIds);
      }
      await supabase.from("template_positions").update(shared).eq("id", position.template_position_id);
    }

    setLoading(false);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="editTitle">
          Position
        </label>
        <input
          id="editTitle"
          className={styles.input}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="editTeam">
          Team
        </label>
        <select id="editTeam" className={styles.select} value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          <option value="">Any team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="editLocation">
          Location
        </label>
        <select
          id="editLocation"
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
      <DateTimeField label="Start time" defaultValue={startTime} onChange={setStartTime} required />
      <DateTimeField label="End time" hint="(optional)" defaultValue={endTime} onChange={setEndTime} />
      <div className={styles.field}>
        <label className={styles.label} htmlFor="editSlots">
          People needed
        </label>
        <input
          id="editSlots"
          type="number"
          min={1}
          className={styles.input}
          required
          value={slots}
          onChange={(event) => setSlots(event.target.value)}
        />
      </div>

      {canApplyToSeries && (
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={applyToSeries}
            onChange={(event) => setApplyToSeries(event.target.checked)}
          />
          Also apply the position/team/location/slots changes to every event in this series
          <span className={styles.hint}>(times stay per-event)</span>
        </label>
      )}

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
