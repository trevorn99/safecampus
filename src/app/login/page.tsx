"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

function Brand() {
  return (
    <div className={styles.authBrand}>
      <Image src="/images/logo.jpg" alt="" width={28} height={28} className={styles.logo} />
      <span className={styles.wordmark}>
        Safe<span className={styles.wordmarkAccent}>Campus</span>
      </span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  async function handleGoogleSignIn() {
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success this navigates away to Google; we only get here on failure.
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    }
  }

  if (status === "sent") {
    return (
      <main className={styles.authShell}>
        <div className={styles.authCard}>
          <Brand />
          <div>
            <h1 className={styles.title}>Check your email</h1>
            <p className={styles.subtitle}>We sent a sign-in link to {email}.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.authShell}>
      <div className={styles.authCard}>
        <Brand />
        <div>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.subtitle}>
            No password needed — we&apos;ll email you a link. New here? The same link creates
            your account.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className={`${styles.button} ${styles.buttonSecondary}`}
          disabled={status === "sending"}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className={styles.input}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <button
            type="submit"
            className={`${styles.button} ${styles.buttonPrimary}`}
            disabled={status === "sending"}
          >
            {status === "sending" ? "Sending…" : "Send sign-in link"}
          </button>
          {status === "error" && <p className={styles.errorText} role="alert">{errorMessage}</p>}
        </form>
      </div>
    </main>
  );
}
