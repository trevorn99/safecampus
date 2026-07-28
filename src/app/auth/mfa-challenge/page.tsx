"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export default function MfaChallengePage() {
  const router = useRouter();
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [webauthnFactorId, setWebauthnFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [usingPasskey, setUsingPasskey] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.[0]?.id ?? null;
      const webauthn = data?.webauthn?.[0]?.id ?? null;
      if (error || (!totp && !webauthn)) {
        router.replace("/login");
        return;
      }
      setTotpFactorId(totp);
      setWebauthnFactorId(webauthn);
      setLoading(false);
    }
    load();
  }, [router]);

  async function completeVerification() {
    if (rememberDevice) {
      // Best-effort — if this fails, the user just gets prompted again next
      // time, which is safe to fail open on.
      await fetch("/api/auth/trust-device", { method: "POST" }).catch(() => {});
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!totpFactorId) return;
    setVerifying(true);
    setError("");

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totpFactorId,
    });
    if (challengeError) {
      setVerifying(false);
      setError(challengeError.message);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setVerifying(false);
      setError(verifyError.message);
      return;
    }
    await completeVerification();
  }

  async function handlePasskey() {
    if (!webauthnFactorId) return;
    setVerifying(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.mfa.webauthn.authenticate({ factorId: webauthnFactorId });
    if (error) {
      setVerifying(false);
      setError(error.message);
      return;
    }
    await completeVerification();
  }

  if (loading) return null;

  return (
    <main className={styles.authShell}>
      <div className={styles.authCard}>
        <div>
          <h1 className={styles.title}>Verify it&apos;s you</h1>
          <p className={styles.subtitle}>
            {webauthnFactorId ? "Use your passkey, or enter a code instead." : "Open your authenticator app for the 6-digit code."}
          </p>
        </div>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(event) => setRememberDevice(event.target.checked)}
          />
          Don&apos;t ask again on this device for 30 days
        </label>

        {webauthnFactorId && !usingPasskey && (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              disabled={verifying}
              onClick={handlePasskey}
            >
              {verifying ? "Waiting for device…" : "Use passkey"}
            </button>
          </div>
        )}

        {webauthnFactorId && totpFactorId && !usingPasskey && (
          <button type="button" className={styles.link} onClick={() => setUsingPasskey(true)}>
            Enter a code instead
          </button>
        )}

        {totpFactorId && (!webauthnFactorId || usingPasskey) && (
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
          </form>
        )}

        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
