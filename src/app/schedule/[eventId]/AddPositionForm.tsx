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
function toZonedInputValue(iso: string, timeZone: string) {
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

export function AddPositionForm({
  eventId,
  eventStartTime,
  teams,
  locations,
  timeZone,
}: {
  eventId: string;
  eventStartTime: string;
  teams: Option[];
  locations: Option[];
  timeZone: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [teamId, setTeamId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [startTime, setStartTime] = useState(toZonedInputValue(eventStartTime, timeZone));
  const [endTime, setEndTime] = useState("");
  const [endTimeResetKey, setEndTimeResetKey] = useState(0);
  const [slots, setSlots] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (endTime && new Date(endTime) <= new Date(startTime)) {
      setError("End time must be after the start time.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.from("event_positions").insert({
      event_id: eventId,
      title,
      team_id: teamId || null,
      location_id: locationId || null,
      start_time: fromZonedInputValue(startTime, timeZone).toISOString(),
      end_time: endTime ? fromZonedInputValue(endTime, timeZone).toISOString() : null,
      slots: Number(slots),
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setTeamId("");
    setLocationId("");
    setEndTime("");
    setEndTimeResetKey((key) => key + 1);
    setSlots("1");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="positionTitle">
          Position
        </label>
        <input
          id="positionTitle"
          className={styles.input}
          required
          placeholder="Main Entrance"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="positionTeam">
          Team <span className={styles.hint}>(optional)</span>
        </label>
        <select
          id="positionTeam"
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
        <label className={styles.label} htmlFor="positionLocation">
          Location <span className={styles.hint}>(optional — uses the event&apos;s location if left blank)</span>
        </label>
        <select
          id="positionLocation"
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
      <DateTimeField
        key={endTimeResetKey}
        label="End time"
        hint="(optional)"
        defaultValue={endTime}
        onChange={setEndTime}
      />
      <div className={styles.field}>
        <label className={styles.label} htmlFor="positionSlots">
          People needed
        </label>
        <input
          id="positionSlots"
          type="number"
          min={1}
          className={styles.input}
          required
          value={slots}
          onChange={(event) => setSlots(event.target.value)}
        />
      </div>
      <div className={styles.actions}>
        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
          {loading ? "Adding…" : "Add position"}
        </button>
      </div>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </form>
  );
}
