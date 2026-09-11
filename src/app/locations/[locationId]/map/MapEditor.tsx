"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ORG_FILES_BUCKET, orgFilePath } from "@/lib/supabase/storage";
import styles from "@/styles/ui.module.css";
import mapStyles from "./map.module.css";

type Pin = { id: string; xPct: number; yPct: number; title: string; postId: string };
type Position = { id: string; title: string; templateName: string | null };

export function MapEditor({
  organizationId,
  locationId,
  canManage,
  map,
  maps,
  pins,
  availablePositions,
  highlightedPostId,
}: {
  organizationId: string;
  locationId: string;
  canManage: boolean;
  map: { id: string; name: string; imageUrl: string | null } | null;
  /** Every map at this location — floors, buildings — for the picker. */
  maps: { id: string; name: string }[];
  pins: Pin[];
  availablePositions: Position[];
  /** Flashes this post's pin so it can be found on a busy floor plan. */
  highlightedPostId?: string | null;
}) {
  const router = useRouter();
  const imgRef = useRef<HTMLImageElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [newMapName, setNewMapName] = useState("");

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

    // Named by the person uploading, falling back to the filename. A picker
    // full of "floorplan-final-v2.png" is no use for telling floors apart,
    // and the unique index on (location_id, name) means two can't collide.
    const { error: mapError } = await supabase.from("maps").insert({
      organization_id: organizationId,
      location_id: locationId,
      name: newMapName.trim() || file.name,
      storage_path: path,
    });
    setUploading(false);
    if (mapError) {
      setError(
        mapError.code === "23505"
          ? `This location already has a map called "${newMapName.trim() || file.name}".`
          : mapError.message,
      );
      return;
    }
    setNewMapName("");
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
      post_id: selectedPositionId,
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

  async function handleRenameMap() {
    if (!map) return;
    const nextName = window.prompt("Name for this map", map.name);
    if (!nextName || nextName.trim() === map.name) return;

    const supabase = createClient();
    const { error: renameError } = await supabase
      .from("maps")
      .update({ name: nextName.trim() })
      .eq("id", map.id);
    if (renameError) {
      setError(
        renameError.code === "23505"
          ? `This location already has a map called "${nextName.trim()}".`
          : renameError.message,
      );
      return;
    }
    router.refresh();
  }

  async function handleDeleteMap() {
    if (!map) return;
    if (
      !window.confirm(
        `Delete the "${map.name}" map? Its pins go with it. The posts themselves stay — they're the places, not the drawing.`,
      )
    ) {
      return;
    }

    const supabase = createClient();
    const { error: deleteError } = await supabase.from("maps").delete().eq("id", map.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    // Back to the location's default map rather than a ?map= pointing at
    // something that no longer exists.
    router.push(`/locations/${locationId}/map`);
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
          className={styles.input}
          placeholder="Map name, e.g. Ground floor"
          value={newMapName}
          onChange={(event) => setNewMapName(event.target.value)}
          disabled={uploading}
        />
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
      {/* Tabs rather than a select: with two or three floors they're all
          visible at once, and each is a real link someone can send. */}
      {maps.length > 1 && (
        <div className={styles.tagRow}>
          {maps.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/locations/${locationId}/map?map=${candidate.id}`}
              className={candidate.id === map.id ? styles.pill : styles.pillMuted}
            >
              {candidate.name}
            </Link>
          ))}
        </div>
      )}

      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{map.name}</h2>
      </div>

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
            className={
              highlightedPostId === pin.postId ? `${mapStyles.pin} ${mapStyles.pinFlash}` : mapStyles.pin
            }
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

      {canManage && <p className={styles.helperText}>Click anywhere on the map to place a post pin.</p>}

      {canManage && (
        <>
          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={handleRenameMap}>
              Rename this map
            </button>
            <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={handleDeleteMap}>
              Delete this map
            </button>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="addMapName">
              Add another map <span className={styles.hint}>(another floor, or another building)</span>
            </label>
            <input
              id="addMapName"
              className={styles.input}
              placeholder="Map name, e.g. First floor"
              value={newMapName}
              onChange={(event) => setNewMapName(event.target.value)}
              disabled={uploading}
            />
            <input
              type="file"
              accept="image/*"
              className={styles.input}
              onChange={handleUpload}
              disabled={uploading}
            />
          </div>
        </>
      )}

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
            <option value="">Select a post</option>
            {availablePositions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.title}
                {position.templateName ? ` — ${position.templateName}` : ""}
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
