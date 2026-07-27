"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

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

  if (status === "sent") {
    return (
      <main className={styles.authShell}>
        <div className={styles.authCard}>
          <p className={styles.wordmark}>
            Safe<span className={styles.wordmarkAccent}>Campus</span>
          </p>
          <div className={styles.badge}>Email sent</div>
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
        <p className={styles.wordmark}>
          Safe<span className={styles.wordmarkAccent}>Campus</span>
        </p>
        <div>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.subtitle}>
            No password needed — we&apos;ll email you a link. New here? The same link creates
            your account.
          </p>
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
              autoFocus
              placeholder="you@example.com"
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
          {status === "error" && <p className={styles.errorText}>{errorMessage}</p>}
        </form>
      </div>
    </main>
  );
}
