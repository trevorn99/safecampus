"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.rpc("create_organization_with_admin", {
      p_org_name: orgName,
      p_admin_name: adminName,
      p_timezone: timezone,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className={styles.authShell}>
      <div className={styles.authCard}>
        <p className={styles.wordmark}>
          Safe<span className={styles.wordmarkAccent}>Campus</span>
        </p>
        <div>
          <h1 className={styles.title}>Set up your organization</h1>
          <p className={styles.subtitle}>
            You&apos;ll be the first admin — you can invite the rest of your team next.
          </p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="orgName">
              Organization name
            </label>
            <input
              id="orgName"
              className={styles.input}
              required
              placeholder="Grace Community Church"
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="adminName">
              Your name
            </label>
            <input
              id="adminName"
              className={styles.input}
              required
              value={adminName}
              onChange={(event) => setAdminName(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="timezone">
              Timezone
              <span className={styles.hint}> — IANA format</span>
            </label>
            <input
              id="timezone"
              className={styles.input}
              required
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </div>
          <button
            type="submit"
            className={`${styles.button} ${styles.buttonPrimary}`}
            disabled={loading}
          >
            {loading ? "Creating…" : "Create organization"}
          </button>
          {error && <p className={styles.errorText} role="alert">{error}</p>}
        </form>
      </div>
    </main>
  );
}
