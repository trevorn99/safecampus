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

// Sign-in is a typed code, not a link.
//
// Emailed links are single-use credentials, and corporate mail filters
// (Proofpoint among them) open every link in a message to inspect it — so a
// link could be spent before its recipient ever clicked it, and they'd land
// here told it had "expired" minutes after it arrived. A code has to be
// read and typed by a person; nothing that merely fetches URLs can use it.
//
// That only holds if the email contains no link that carries the same
// credential. Codes are mailed by the app (lib/signInCode.ts) and contain
// only the code, and the invitation carries no code at all: its button
// opens this page, where the invitee asks for one. Opening that link does
// nothing a scanner could exploit, which is also why this page never sends
// a code on load.

// Old links still in inboxes land here via /auth/confirm when they fail.
// Looked up in a fixed map, never rendered from the URL itself.
const NOTICES: Record<string, { lead: string; detail: string }> = {
  invite: {
    lead: "That invitation link has already been used, or has expired.",
    detail: "Enter your email below and we'll send you a code — it signs you in and accepts the invitation just the same.",
  },
  link: {
    lead: "That sign-in link has already been used, or has expired.",
    detail: "Sign-in now uses a code instead of a link. Enter your email below and we'll send one.",
  },
  auth: {
    lead: "We couldn't finish signing you in.",
    detail: "Enter your email below and we'll send you a code.",
  },
};

const OTP_KINDS = ["email", "invite"] as const;

function friendlyVerifyError(message: string): string {
  return /expired|invalid/i.test(message)
    ? "That code isn't right, or it has expired. Check the most recent email from SafeCampus, or send yourself a new code."
    : message;
}

function LoginForm() {
  const params = useSearchParams();
  const prefilled = (params.get("email") ?? "").trim();
  const fromInvite = params.get("invite") === "1" && Boolean(prefilled);

  const [email, setEmail] = useState(prefilled);
  // An invitation lands on its own screen, and nothing is sent until the
  // invitee presses a button: mail scanners open the invitation's link, and
  // a page that mailed a code on load would let them trigger one.
  const [step, setStep] = useState<"email" | "invite" | "code">(fromInvite ? "invite" : "email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const reason = params.get("error");
  const noticeKey = reason === "link" && params.get("kind") === "invite" ? "invite" : reason;
  const notice = step === "email" && noticeKey ? NOTICES[noticeKey] : null;

  // Codes are minted and mailed by the app (lib/signInCode.ts), not by
  // Supabase's signInWithOtp: that pipe ran through a separately configured
  // SMTP and a pasted dashboard template, and failed to deliver when tested.
  async function sendCode() {
    const address = email.trim().toLowerCase();
    setBusy(true);
    setError("");
    setInfo("");

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      data = await response.json().catch(() => ({}));
    } catch {
      setBusy(false);
      setError("Something went wrong — please check your connection and try again.");
      return;
    }

    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "We couldn't send a code just now. Please try again.");
      return;
    }
    setEmail(address);
    setCode("");
    setStep("code");
    setInfo(`We emailed a code to ${address}. It can take a minute to arrive — check your junk folder too.`);
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    await sendCode();
  }

  async function handleCodeSubmit(event: FormEvent) {
    event.preventDefault();
    const token = code.replace(/\D/g, "");
    const address = email.trim().toLowerCase();
    setBusy(true);
    setError("");

    const supabase = createClient();
    // An existing account's code verifies as "email"; one that created the
    // account verifies as "invite". The page isn't told which — the send
    // route must not reveal whether an address has an account — so it
    // tries both.
    let lastError = "";
    for (const type of OTP_KINDS) {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: address, token, type });
      if (!verifyError) {
        // The session cookie is set; the server decides where to go next
        // (MFA, activating the membership, claiming a roster entry). A full
        // navigation, not router.push: /auth/continue is a route handler
        // that answers with a redirect, which client-side routing can't
        // follow.
        window.location.assign(new URL("/auth/continue", window.location.origin).toString());
        return;
      }
      lastError = verifyError.message;
    }

    setBusy(false);
    setError(friendlyVerifyError(lastError));
  }

  async function handleGoogleSignIn() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success this navigates away to Google; we only get here on failure.
    if (oauthError) {
      setBusy(false);
      setError(oauthError.message);
    }
  }

  const googleButton = (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      className={`${styles.button} ${styles.buttonSecondary}`}
      disabled={busy}
    >
      <GoogleIcon />
      Continue with Google
    </button>
  );

  const errorBlock = error && (
    <p className={styles.errorText} role="alert">
      {error}
    </p>
  );

  if (step === "invite") {
    return (
      <>
        <div>
          <h1 className={styles.title}>Accept your invitation</h1>
          <p className={styles.subtitle}>
            We&apos;ll email a 6-digit sign-in code to <strong>{email}</strong>. Type it on the next screen and
            you&apos;re in — no password to choose.
          </p>
        </div>

        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary}`}
          disabled={busy}
          onClick={() => void sendCode()}
        >
          {busy ? "Sending…" : "Email me my code"}
        </button>
        {errorBlock}

        <div className={styles.divider}>
          <span>or</span>
        </div>

        {/* Supabase attaches a Google sign-in to the existing account when
            the address matches, so the invitation — already linked to that
            account — carries over with no code. A different Google address
            is a different account, hence the wording. */}
        {googleButton}
        <p className={styles.hint}>Only if {email} is your Google account.</p>

        <p className={styles.hint}>
          Not you?{" "}
          <button
            type="button"
            className={styles.linkButton}
            disabled={busy}
            onClick={() => {
              setStep("email");
              setEmail("");
              setError("");
            }}
          >
            Sign in with a different email
          </button>
        </p>
      </>
    );
  }

  if (step === "code") {
    return (
      <>
        <div>
          <h1 className={styles.title}>Enter your code</h1>
          <p className={styles.subtitle}>
            Type the 6-digit code we emailed to {email}. It works once and expires after a while.
          </p>
        </div>

        <form onSubmit={handleCodeSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="code">
              Code
            </label>
            <input
              id="code"
              className={styles.input}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={12}
              required
              autoFocus
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, ""))}
            />
          </div>
          <button
            type="submit"
            className={`${styles.button} ${styles.buttonPrimary}`}
            disabled={busy || code.replace(/\D/g, "").length < 6}
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
          {info && !error && <p className={styles.hint}>{info}</p>}
          {errorBlock}
        </form>

        <p className={styles.hint}>
          No code, or it expired?{" "}
          <button type="button" className={styles.linkButton} disabled={busy} onClick={() => void sendCode()}>
            Send a new code
          </button>{" "}
          ·{" "}
          <button
            type="button"
            className={styles.linkButton}
            disabled={busy}
            onClick={() => {
              setStep("email");
              setCode("");
              setError("");
              setInfo("");
            }}
          >
            Use a different email
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      <div>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>
          No password needed — we&apos;ll email you a 6-digit code. New here? The same code creates
          your account.
        </p>
      </div>

      {notice && (
        <p className={styles.errorText} role="alert">
          <strong>{notice.lead}</strong> {notice.detail}
        </p>
      )}

      {googleButton}

      <div className={styles.divider}>
        <span>or</span>
      </div>

      <form onSubmit={handleEmailSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className={styles.input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy}>
          {busy ? "Sending…" : "Email me a code"}
        </button>
        {errorBlock}
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className={styles.authShell}>
      <div className={styles.authCard}>
        <Brand />
        {/* useSearchParams opts the tree out of prerendering up to the
            nearest Suspense boundary, and /login is a static page; without
            the boundary the production build fails. */}
        <Suspense
          fallback={
            <div>
              <h1 className={styles.title}>Sign in</h1>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
        <p className={styles.hint}>
          By continuing, you agree to our <a href="/terms" className={styles.link}>Terms</a> and{" "}
          <a href="/privacy" className={styles.link}>Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
