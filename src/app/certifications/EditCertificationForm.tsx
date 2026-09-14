"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

// Editing was permitted by the database from the start — "self or admin
// updates certifications" — but there was no way to do it, so a typo in an
// expiry date meant deleting the record and uploading the file again.
//
// The file itself isn't editable here. Replacing a document is a different
// operation from correcting a date, and conflating them would mean a
// mistyped date could silently drop the evidence.
export function EditCertificationForm({
  certification,
  canDelete,
}: {
  certification: { id: string; type: string; issued_at: string | null; expires_at: string | null };
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(certification.type);
  const [issuedAt, setIssuedAt] = useState(certification.issued_at ?? "");
  const [expiresAt, setExpiresAt] = useState(certification.expires_at ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!type.trim()) {
      setError("Give the certification a type.");
      return;
    }
    if (issuedAt && expiresAt && expiresAt < issuedAt) {
      setError("The expiry date is before the issue date.");
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createClient();
    // .select() so a row the policy filters out comes back empty rather than
    // looking like a successful save — an update RLS disallows is not an
    // error, it simply matches nothing.
    const { data, error: updateError } = await supabase
      .from("certifications")
      .update({
        type: type.trim(),
        issued_at: issuedAt || null,
        expires_at: expiresAt || null,
      })
      .eq("id", certification.id)
      .select("id");

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("That didn't save — you can only edit your own certifications, unless you're an org admin.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete the "${certification.type}" certification? Its file goes with it.`)) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error: deleteError } = await supabase
      .from("certifications")
      .delete()
      .eq("id", certification.id)
      .select("id");

    setLoading(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("That didn't delete — only an org admin can remove a certification.");
      return;
    }
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className={styles.linkButton} onClick={() => setOpen(true)}>
        Edit
      </button>
    );
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`cert-type-${certification.id}`}>
          Type
        </label>
        <input
          id={`cert-type-${certification.id}`}
          className={styles.input}
          required
          value={type}
          onChange={(event) => setType(event.target.value)}
          disabled={loading}
        />
      </div>
      <div className={styles.tagRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`cert-issued-${certification.id}`}>
            Issued
          </label>
          <input
            id={`cert-issued-${certification.id}`}
            type="date"
            className={styles.input}
            value={issuedAt}
            onChange={(event) => setIssuedAt(event.target.value)}
            disabled={loading}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`cert-expires-${certification.id}`}>
            Expires
          </label>
          <input
            id={`cert-expires-${certification.id}`}
            type="date"
            className={styles.input}
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            disabled={loading}
          />
        </div>
      </div>
      <div className={styles.actions}>
        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
          {loading ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={() => setOpen(false)}
          disabled={loading}
        >
          Cancel
        </button>
        {canDelete && (
          <button
            type="button"
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={remove}
            disabled={loading}
          >
            Delete
          </button>
        )}
      </div>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
