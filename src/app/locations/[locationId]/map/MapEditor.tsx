"use client";

import { useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ORG_FILES_BUCKET, orgFilePath } from "@/lib/supabase/storage";
import styles from "@/styles/ui.module.css";
import mapStyles from "./map.module.css";

type Pin = { id: string; xPct: number; yPct: number; title: string };
type Position = { id: string; title: string };

export function MapEditor({
  organizationId,
  locationId,
  canManage,
  map,
  pins,
  availablePositions,
}: {
  organizationId: string;
  locationId: string;
  canManage: boolean;
  map: { id: string; imageUrl: string | null } | null;
  pins: Pin[];
  availablePositions: Position[];
}) {
  const router = useRouter();
  const imgRef = useRef<HTMLImageElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState("");

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");

    const supabase = createClient();
    const path = orgFilePath(organizationId, "maps", file.name);
    const { error: uploadError } = await supabase.storage.from(ORG_FILES_BUCKET).upload(path, file);
    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { error: mapError } = await supabase.from("maps").insert({
      organization_id: organizationId,
      location_id: locationId,
      name: file.name,
      storage_path: path,
    });
    setUploading(false);
    if (mapError) {
      setError(mapError.message);
      return;
    }
    router.refresh();
  }

  function handleImageClick(event: ReactMouseEvent<HTMLImageElement>) {
    if (!canManage || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPendingClick({ x, y });
    setSelectedPositionId("");
  }

  async function handleAddPin() {
    if (!pendingClick || !selectedPositionId || !map) return;
    const supabase = createClient();
    const { error: pinError } = await supabase.from("map_pins").insert({
      map_id: map.id,
      template_position_id: selectedPositionId,
      x_pct: pendingClick.x.toFixed(2),
      y_pct: pendingClick.y.toFixed(2),
    });
    if (pinError) {
      setError(pinError.message);
      return;
    }
    setPendingClick(null);
    router.refresh();
  }

  async function handleRemovePin(pinId: string) {
    const supabase = createClient();
    await supabase.from("map_pins").delete().eq("id", pinId);
    router.refresh();
  }

  if (!map) {
    if (!canManage) {
      return (
        <div className={styles.card}>
          <p className={styles.helperText}>No map has been uploaded for this location yet.</p>
        </div>
      );
    }
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Upload a map</h2>
        <p className={styles.subtitle}>
          A floor plan or campus image — you&apos;ll place position pins on it next.
        </p>
        <input
          type="file"
          accept="image/*"
          className={styles.input}
          onChange={handleUpload}
          disabled={uploading}
        />
        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={mapStyles.mapFrame}>
        {map.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- private, expiring signed URL; not worth next/image's remote-pattern + caching complexity here
          <img
            ref={imgRef}
            src={map.imageUrl}
            alt="Location map"
            className={mapStyles.mapImage}
            onClick={handleImageClick}
          />
        )}
        {pins.map((pin) => (
          <div
            key={pin.id}
            className={mapStyles.pin}
            style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%` }}
          >
            <span className={mapStyles.pinLabel}>{pin.title}</span>
            {canManage && (
              <button
                type="button"
                className={mapStyles.pinRemove}
                onClick={() => handleRemovePin(pin.id)}
                aria-label={`Remove ${pin.title} pin`}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {canManage && <p className={styles.helperText}>Click anywhere on the map to place a position pin.</p>}

      {canManage && pendingClick && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="pinPosition">
            Which position?
          </label>
          <select
            id="pinPosition"
            className={styles.select}
            value={selectedPositionId}
            onChange={(event) => setSelectedPositionId(event.target.value)}
          >
            <option value="">Select a position</option>
            {availablePositions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.title}
              </option>
            ))}
          </select>
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              disabled={!selectedPositionId}
              onClick={handleAddPin}
            >
              Place pin
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={() => setPendingClick(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
