"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ORG_FILES_BUCKET, orgFilePath } from "@/lib/supabase/storage";
import styles from "@/styles/ui.module.css";

export function UploadCertificationForm({
  memberId,
  organizationId,
}: {
  memberId: string;
  organizationId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    let documentId: string | null = null;

    if (file) {
      const path = orgFilePath(organizationId, "certifications", file.name);
      const { error: uploadError } = await supabase.storage.from(ORG_FILES_BUCKET).upload(path, file);
      if (uploadError) {
        setLoading(false);
        setError(uploadError.message);
        return;
      }

      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          organization_id: organizationId,
          category: "certificate",
          storage_path: path,
          uploaded_by: memberId,
        })
        .select("id")
        .single();
      if (docError) {
        setLoading(false);
        setError(docError.message);
        return;
      }
      documentId = doc.id;
    }

    const { error: certError } = await supabase.from("certifications").insert({
      member_id: memberId,
      type,
      issued_at: issuedAt || null,
      expires_at: expiresAt || null,
      document_id: documentId,
    });

    setLoading(false);
    if (certError) {
      setError(certError.message);
      return;
    }

    setType("");
    setIssuedAt("");
    setExpiresAt("");
    setFile(null);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => setOpen(true)}>
          + Add certification
        </button>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>New certification</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="certType">
            Type
          </label>
          <input
            id="certType"
            className={styles.input}
            required
            placeholder="CPR / First Aid"
            value={type}
            onChange={(event) => setType(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="certIssued">
            Issued <span className={styles.hint}>(optional)</span>
          </label>
          <input
            id="certIssued"
            type="date"
            className={styles.input}
            value={issuedAt}
            onChange={(event) => setIssuedAt(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="certExpires">
            Expires <span className={styles.hint}>(optional)</span>
          </label>
          <input
            id="certExpires"
            type="date"
            className={styles.input}
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="certFile">
            Upload file <span className={styles.hint}>(optional — photo or PDF)</span>
          </label>
          <input
            id="certFile"
            type="file"
            accept="image/*,.pdf"
            className={styles.input}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
            {loading ? "Saving…" : "Save certification"}
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={() => setOpen(false)}
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
    </div>
  );
}
