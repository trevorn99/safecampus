"use client";

import { useState } from "react";
import { EditPositionForm } from "./EditPositionForm";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };

export function PositionHeader({
  position,
  metaText,
  teams,
  locations,
  seriesId,
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
  metaText: string;
  teams: Option[];
  locations: Option[];
  seriesId: string | null;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{position.title}</h2>
        <EditPositionForm
          position={position}
          teams={teams}
          locations={locations}
          seriesId={seriesId}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className={styles.cardHeader}>
      <div className={styles.tagRow}>
        <h2 className={styles.cardTitle}>{position.title}</h2>
        <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
      <p className={styles.itemMeta}>{metaText}</p>
    </div>
  );
}
