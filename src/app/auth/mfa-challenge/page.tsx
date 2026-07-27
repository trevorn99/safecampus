"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export default function MfaChallengePage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data?.totp?.length) {
        router.replace("/login");
        return;
      }
      setFactorId(data.totp[0].id);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setVerifying(true);
    setError("");

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setVerifying(false);
      setError(challengeError.message);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setVerifying(false);
      setError(verifyError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (loading) return null;

  return (
    <main className={styles.authShell}>
      <div className={styles.authCard}>
        <div>
          <h1 className={styles.title}>Enter your code</h1>
          <p className={styles.subtitle}>Open your authenticator app for the 6-digit code.</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="code">
              Verification code
            </label>
            <input
              id="code"
              className={styles.input}
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={verifying}>
            {verifying ? "Verifying…" : "Verify"}
          </button>
          {error && (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
