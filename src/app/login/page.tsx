"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { centeredStyle, formStyle, errorStyle } from "@/lib/ui";

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
      <main style={centeredStyle}>
        <h1>Check your email</h1>
        <p>We sent a sign-in link to {email}.</p>
      </main>
    );
  }

  return (
    <main style={centeredStyle}>
      <h1>Sign in to SafeCampus</h1>
      <p>No password needed — we&apos;ll email you a link. New here? The same link creates your account.</p>
      <form onSubmit={handleSubmit} style={formStyle}>
        <label>
          Email
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send sign-in link"}
        </button>
        {status === "error" && <p style={errorStyle}>{errorMessage}</p>}
      </form>
    </main>
  );
}
