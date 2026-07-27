"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import styles from "@/styles/ui.module.css";

const VIEWPORT = 240;
const OUTPUT = 320;
const MIN_SCALE = 1;
const MAX_SCALE = 3;

type Offset = { x: number; y: number };

export function AvatarCropper({
  file,
  onCancel,
  onSave,
}: {
  file: File;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origin: Offset } | null>(null);
  const [imageUrl] = useState(() => URL.createObjectURL(file));
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl]);

  const baseScale = naturalSize
    ? Math.max(VIEWPORT / naturalSize.width, VIEWPORT / naturalSize.height)
    : 0;
  const displayedScale = baseScale * scale;
  const displayedWidth = naturalSize ? naturalSize.width * displayedScale : 0;
  const displayedHeight = naturalSize ? naturalSize.height * displayedScale : 0;
  const maxOffsetX = Math.max(0, (displayedWidth - VIEWPORT) / 2);
  const maxOffsetY = Math.max(0, (displayedHeight - VIEWPORT) / 2);

  function clamp(next: Offset, boundsX: number, boundsY: number): Offset {
    return {
      x: Math.min(boundsX, Math.max(-boundsX, next.x)),
      y: Math.min(boundsY, Math.max(-boundsY, next.y)),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = { startX: event.clientX, startY: event.clientY, origin: offset };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const { startX, startY, origin } = dragRef.current;
    setOffset(
      clamp(
        { x: origin.x + (event.clientX - startX), y: origin.y + (event.clientY - startY) },
        maxOffsetX,
        maxOffsetY,
      ),
    );
  }

  function handleScaleChange(next: number) {
    setScale(next);
    if (!naturalSize) return;
    const nextDisplayedScale = baseScale * next;
    const nextWidth = naturalSize.width * nextDisplayedScale;
    const nextHeight = naturalSize.height * nextDisplayedScale;
    setOffset((prev) =>
      clamp(prev, Math.max(0, (nextWidth - VIEWPORT) / 2), Math.max(0, (nextHeight - VIEWPORT) / 2)),
    );
  }

  function handleSave() {
    const img = imgRef.current;
    if (!img || !naturalSize) return;

    const visibleLeft = displayedWidth / 2 - VIEWPORT / 2 - offset.x;
    const visibleTop = displayedHeight / 2 - VIEWPORT / 2 - offset.y;
    const sourceSize = VIEWPORT / displayedScale;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      visibleLeft / displayedScale,
      visibleTop / displayedScale,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT,
      OUTPUT,
    );
    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, "image/png");
  }

  return (
    <div className={styles.form}>
      <div
        className={styles.cropperViewport}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => (dragRef.current = null)}
        onPointerLeave={() => (dragRef.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- transform/size are computed per-drag, not next/image-compatible */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          draggable={false}
          className={styles.cropperImage}
          onLoad={(event) =>
            setNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          style={{
            width: displayedWidth || undefined,
            height: displayedHeight || undefined,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="avatarZoom">
          Zoom
        </label>
        <input
          id="avatarZoom"
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.01}
          value={scale}
          onChange={(event) => handleScaleChange(Number(event.target.value))}
        />
      </div>
      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleSave}>
          Save
        </button>
        <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
