"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type EnrolledFactor = { id: string; friendly_name?: string };

export function MfaManager() {
  const router = useRouter();
  const [factors, setFactors] = useState<EnrolledFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function loadFactors() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    // data.totp is already filtered to verified factors by the API.
    setFactors(data?.totp ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // The lint rule can't distinguish this from a synchronous setState —
    // loadFactors is async and only sets state after the awaited network
    // call resolves, so there's no cascading-render issue here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFactors();
  }, []);

  async function handleEnroll() {
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "SafeCampus" });
    if (error) {
      setError(error.message);
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  }

  async function handleVerify() {
    if (!factorId) return;
    setError("");
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setError(challengeError.message);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    setEnrolling(false);
    setCode("");
    await loadFactors();
    router.refresh();
  }

  async function handleRemove(id: string) {
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId: id });
    await loadFactors();
  }

  if (loading) return null;

  return (
    <div className={styles.card}>
      {factors.length > 0 && !enrolling && (
        <>
          <span className={styles.badge}>Enabled</span>
          <ul className={styles.list}>
            {factors.map((factor) => (
              <li key={factor.id} className={styles.listRow}>
                <p className={styles.itemName}>{factor.friendly_name ?? "Authenticator app"}</p>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  onClick={() => handleRemove(factor.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {factors.length === 0 && !enrolling && (
        <div className={styles.actions}>
          <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleEnroll}>
            Set up authenticator app
          </button>
        </div>
      )}

      {enrolling && qrCode && (
        <div className={styles.form}>
          <p className={styles.helperText}>
            Scan this with an authenticator app (Google Authenticator, 1Password, Authy), then
            enter the 6-digit code it shows.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- qrCode is already a data: URL from Supabase's enroll response, not a next/image-compatible asset */}
          <img
            src={qrCode}
            alt="Scan with your authenticator app"
            width={200}
            height={200}
          />
          {secret && (
            <p className={styles.itemMeta}>Can&apos;t scan? Enter this code manually: {secret}</p>
          )}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="mfaCode">
              Verification code
            </label>
            <input
              id="mfaCode"
              className={styles.input}
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleVerify}>
              Verify &amp; enable
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={() => setEnrolling(false)}
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
