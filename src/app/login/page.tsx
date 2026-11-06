"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

function Brand() {
  return (
    <div className={styles.authBrand}>
      <Image src="/images/logo-mark.png" alt="" width={28} height={28} className={styles.logo} />
      <span className={styles.wordmark}>
        Safe<span className={styles.wordmarkAccent}>Campus</span>
      </span>
      <span className={styles.devBadge}>Beta</span>
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

// Why someone landed back here rather than signed in. /auth/confirm and
// /auth/callback both redirect to /login with a reason, and until recently
// nothing read it — an expired invitation dropped the recipient on a blank
// sign-in form with no explanation, which reads as "that link was fake".
//
// The copy names the scanner case on purpose. These links are single-use,
// and corporate mail filters open links to inspect them, so an invitation
// can be spent before its recipient ever clicks it. Someone told only "that
// link has expired" when they received it four minutes ago concludes
// something is broken, or that the mail was never genuine; the recovery is
// the same either way, so the message leads with it.
//
// Separate component inside a Suspense boundary because useSearchParams
// opts the tree out of prerendering up to the nearest boundary, and /login
// is a static page; without the boundary the production build fails.
const SCANNER_NOTE =
  "Security scanners on some mail systems open links automatically, which can use one up before you get to it.";

const NOTICES: Record<string, { lead: string; detail: string }> = {
  // An invitation, for someone who has never signed in and would not
  // recognise their invitation described as a "sign-in link".
  invite: {
    lead: "That invitation link has already been used, or has expired.",
    detail: `${SCANNER_NOTE} Enter your email below and we'll send a new link — it signs you in and accepts the invitation just the same.`,
  },
  link: {
    lead: "That sign-in link has already been used, or has expired.",
    detail: `${SCANNER_NOTE} Enter your email below and we'll send a fresh one.`,
  },
  auth: {
    lead: "We couldn't finish signing you in.",
    detail: "Enter your email below and we'll send a new link.",
  },
};

function SignInNotice() {
  const params = useSearchParams();
  const reason = params.get("error");
  if (!reason) return null;

  // Looked up in a fixed map, never rendered from the URL itself.
  const key = reason === "link" && params.get("kind") === "invite" ? "invite" : reason;
  const notice = NOTICES[key];
  if (!notice) return null;

  return (
    <p className={styles.errorText} role="alert">
      <strong>{notice.lead}</strong> {notice.detail}
    </p>
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

        <Suspense fallback={null}>
          <SignInNotice />
        </Suspense>

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
        <p className={styles.hint}>
          By continuing, you agree to our <a href="/terms" className={styles.link}>Terms</a> and{" "}
          <a href="/privacy" className={styles.link}>Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
