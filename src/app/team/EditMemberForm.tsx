"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

// A member record had no way to be corrected. An admin who mistyped an email,
// or added someone to the roster without one, could only delete and re-add —
// which takes their assignments and team memberships with it.
export function EditMemberForm({
  memberId,
  name,
  email,
  linked,
  onClose,
}: {
  memberId: string;
  name: string;
  email: string | null;
  /** Whether this member has an account yet; changes what the email means. */
  linked: boolean;
  /** The row owns the Edit button; this is only the panel it opens. */
  onClose: () => void;
}) {
  const router = useRouter();
  const [nextName, setNextName] = useState(name);
  const [nextEmail, setNextEmail] = useState(email ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/team/update-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, name: nextName, email: nextEmail }),
      });
      data = await response.json();
    } catch {
      setLoading(false);
      setError("Something went wrong — please try again.");
      return;
    }

    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`member-name-${memberId}`}>
          Name
        </label>
        <input
          id={`member-name-${memberId}`}
          className={styles.input}
          required
          value={nextName}
          onChange={(event) => setNextName(event.target.value)}
          disabled={loading}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`member-email-${memberId}`}>
          Email {!linked && <span className={styles.hint}>(links them to their account when they sign in)</span>}
        </label>
        <input
          id={`member-email-${memberId}`}
          type="email"
          className={styles.input}
          value={nextEmail}
          onChange={(event) => setNextEmail(event.target.value)}
          disabled={loading}
        />
        {linked && (
          <p className={styles.hint}>
            This is where their reminders go. It doesn&apos;t change the address they sign in with — only they can
            do that.
          </p>
        )}
      </div>
      <div className={styles.actions}>
        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
          {loading ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={() => onClose()}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
