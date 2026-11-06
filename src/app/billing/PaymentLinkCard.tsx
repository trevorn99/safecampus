"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

// For when the person who pays isn't on the team — a treasurer, a business
// office. They get an email with a link that opens the plan and price and
// then Stripe's checkout, no account needed. See lib/paymentLinks.ts.
export function PaymentLinkCard({
  activeLink,
}: {
  activeLink: { payerEmail: string; expiresAt: string } | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  async function post(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    setSent("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data: { error?: string } = await response.json().catch(() => ({}));
      setBusy(false);
      if (!response.ok) {
        setError(data.error ?? "Something went wrong — please try again.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setBusy(false);
      setError("Something went wrong — please check your connection and try again.");
      return false;
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (await post("/api/billing/payment-link", { email: address })) {
      setSent(`Sent to ${address}.`);
      setEmail("");
    }
  }

  async function cancel() {
    if (!window.confirm("Cancel the payment link? It will stop working straight away.")) return;
    await post("/api/billing/payment-link/revoke");
  }

  const expires = activeLink
    ? new Date(activeLink.expiresAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Someone else paying?</h2>
        <p className={styles.helperText}>
          Send a payment link to whoever handles your organization&apos;s bills — they don&apos;t need a SafeCampus
          account. The link shows the plan and price, then opens Stripe&apos;s secure checkout. Receipts go to them,
          and they can&apos;t see anything else in SafeCampus.
        </p>
      </div>

      {activeLink && (
        <p className={styles.itemMeta}>
          A link was sent to <strong>{activeLink.payerEmail}</strong> and works until {expires}. Sending a new one
          replaces it.{" "}
          <button type="button" className={styles.linkButton} disabled={busy} onClick={() => void cancel()}>
            Cancel link
          </button>
        </p>
      )}

      <form onSubmit={send} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="payer-email">
            Their email
          </label>
          <input
            id="payer-email"
            className={styles.input}
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy}>
            {busy ? "Sending…" : activeLink ? "Send a new link" : "Send payment link"}
          </button>
        </div>
        {sent && <p className={styles.hint}>{sent}</p>}
        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
