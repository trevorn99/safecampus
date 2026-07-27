"use client";

import { useState } from "react";
import styles from "@/styles/ui.module.css";

export function ExemptionToggle({
  organizationId,
  exempt,
}: {
  organizationId: string;
  exempt: boolean;
}) {
  const [current, setCurrent] = useState(exempt);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const response = await fetch("/api/platform-admin/toggle-exemption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, exempt: !current }),
    });
    setLoading(false);
    if (response.ok) {
      setCurrent(!current);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`${styles.button} ${current ? styles.buttonPrimary : styles.buttonSecondary}`}
    >
      {current ? "Exempt (paywall bypassed)" : "Grant exemption"}
    </button>
  );
}
