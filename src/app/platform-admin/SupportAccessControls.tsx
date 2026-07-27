"use client";

import { useState } from "react";
import styles from "@/styles/ui.module.css";

type ActiveGrant = {
  id: string;
  platformAdminId: string;
  adminName: string;
  reason: string;
  expiresAt: string;
};

export function SupportAccessControls({
  organizationId,
  currentUserId,
  activeGrant,
}: {
  organizationId: string;
  currentUserId: string;
  activeGrant: ActiveGrant | null;
}) {
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState("4");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function requestAccess() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setLoading(true);
    setError("");
    const response = await fetch("/api/platform-admin/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, reason, hours: Number(hours) }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }
    window.location.reload();
  }

  async function revokeAccess(grantId: string) {
    setLoading(true);
    setError("");
    const response = await fetch("/api/platform-admin/revoke-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grantId }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }
    window.location.reload();
  }

  if (activeGrant) {
    return (
      <div className={styles.tagRow}>
        <span className={styles.pillMuted}>
          {activeGrant.adminName} · until {new Date(activeGrant.expiresAt).toLocaleString()}
        </span>
        {activeGrant.platformAdminId === currentUserId && (
          <a
            href={`/platform-admin/${organizationId}`}
            className={`${styles.button} ${styles.buttonPrimary}`}
          >
            Troubleshoot
          </a>
        )}
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          disabled={loading}
          onClick={() => revokeAccess(activeGrant.id)}
        >
          Revoke
        </button>
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className={styles.tagRow}>
      <input
        className={styles.input}
        placeholder="Reason (required)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <select className={styles.select} value={hours} onChange={(event) => setHours(event.target.value)}>
        <option value="1">1 hour</option>
        <option value="4">4 hours</option>
        <option value="24">24 hours</option>
      </select>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        onClick={requestAccess}
      >
        Request access
      </button>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </div>
  );
}
