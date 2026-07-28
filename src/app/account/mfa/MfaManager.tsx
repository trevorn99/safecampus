"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type EnrolledFactor = { id: string; friendly_name?: string; factor_type: string };

function factorLabel(factor: EnrolledFactor) {
  if (factor.friendly_name) return factor.friendly_name;
  return factor.factor_type === "webauthn" ? "Passkey" : "Authenticator app";
}

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
  const [webauthnSupported, setWebauthnSupported] = useState(false);
  const [passkeyName, setPasskeyName] = useState("");
  const [addingPasskey, setAddingPasskey] = useState(false);

  async function loadFactors() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    // .totp/.webauthn are each already filtered to verified factors by the API.
    setFactors([...(data?.totp ?? []), ...(data?.webauthn ?? [])]);
    setLoading(false);
  }

  useEffect(() => {
    // The lint rule can't distinguish this from a synchronous setState —
    // loadFactors is async and only sets state after the awaited network
    // call resolves, so there's no cascading-render issue here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFactors();
    setWebauthnSupported(typeof window !== "undefined" && "PublicKeyCredential" in window);
  }, []);

  async function handleEnroll() {
    setError("");
    const supabase = createClient();

    // A previous enroll that was never verified (e.g. abandoned mid-setup)
    // leaves an unverified factor with a blank friendly name behind, which
    // blocks a fresh enroll with the same default name. `.totp` here is
    // filtered to verified-only by the API, so check `.all` instead, which
    // includes both.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    const stale = existing?.all?.find(
      (factor) => factor.factor_type === "totp" && factor.status === "unverified",
    );
    if (stale) {
      await supabase.auth.mfa.unenroll({ factorId: stale.id });
    }

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

  async function handleAddPasskey() {
    setError("");
    setAddingPasskey(true);
    const supabase = createClient();

    // Same class of issue as the TOTP stale-factor case: if a previous
    // passkey ceremony was cancelled (e.g. the user dismissed the Face ID/
    // Touch ID prompt) after enrolling but before verifying, it leaves an
    // unverified webauthn factor behind. Clear it first.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    const stale = existing?.all?.find(
      (factor) => factor.factor_type === "webauthn" && factor.status === "unverified",
    );
    if (stale) {
      await supabase.auth.mfa.unenroll({ factorId: stale.id });
    }

    const { error } = await supabase.auth.mfa.webauthn.register({
      friendlyName: passkeyName.trim() || "Passkey",
    });
    setAddingPasskey(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPasskeyName("");
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
                <div>
                  <p className={styles.itemName}>{factorLabel(factor)}</p>
                  <p className={styles.itemMeta}>
                    {factor.factor_type === "webauthn" ? "Passkey / security key" : "Authenticator app"}
                  </p>
                </div>
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

      {!enrolling && (
        <div className={styles.form}>
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleEnroll}>
              Set up authenticator app
            </button>
          </div>

          {webauthnSupported && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="passkeyName">
                Add a passkey <span className={styles.hint}>(Face ID, Touch ID, Windows Hello, or a security key)</span>
              </label>
              <div className={styles.tagRow}>
                <input
                  id="passkeyName"
                  className={styles.input}
                  placeholder="e.g. MacBook Touch ID"
                  value={passkeyName}
                  onChange={(event) => setPasskeyName(event.target.value)}
                />
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  disabled={addingPasskey}
                  onClick={handleAddPasskey}
                >
                  {addingPasskey ? "Waiting for device…" : "Add passkey"}
                </button>
              </div>
            </div>
          )}
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
