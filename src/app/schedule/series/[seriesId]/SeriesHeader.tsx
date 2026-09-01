"use client";

import { useState } from "react";
import { EditSeriesForm } from "./EditSeriesForm";
import { ActiveToggle } from "./ActiveToggle";
import { GenerateNowButton } from "./GenerateNowButton";
import { DeleteSeriesButton } from "./DeleteSeriesButton";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };

export function SeriesHeader({
  series,
  eventTypes,
  locations,
}: {
  series: {
    id: string;
    title: string;
    type: string;
    location_id: string | null;
    first_occurrence_at: string;
    duration_minutes: number;
    recurrence_rule: string;
    active: boolean;
  };
  eventTypes: string[];
  locations: Option[];
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Edit series</h2>
        </div>
        <EditSeriesForm series={series} eventTypes={eventTypes} locations={locations} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.itemMeta}>
        First occurrence {new Date(series.first_occurrence_at).toLocaleString()} · {series.duration_minutes} minutes
      </p>
      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => setEditing(true)}>
          Edit series
        </button>
        <ActiveToggle seriesId={series.id} active={series.active} />
        <DeleteSeriesButton seriesId={series.id} title={series.title} />
      </div>
      <GenerateNowButton seriesId={series.id} />
    </div>
  );
}
