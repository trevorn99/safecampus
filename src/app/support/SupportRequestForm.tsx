"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ORG_FILES_BUCKET, orgFilePath } from "@/lib/supabase/storage";
import styles from "@/styles/ui.module.css";

export function SupportRequestForm({
  memberId,
  organizationId,
}: {
  memberId: string;
  organizationId: string;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const attachmentPaths: string[] = [];

    for (const file of files) {
      const path = orgFilePath(organizationId, "support", file.name);
      const { error: uploadError } = await supabase.storage.from(ORG_FILES_BUCKET).upload(path, file);
      if (uploadError) {
        setLoading(false);
        setError(`Failed to upload ${file.name}: ${uploadError.message}`);
        return;
      }
      attachmentPaths.push(path);
    }

    const { error: insertError } = await supabase.from("support_tickets").insert({
      organization_id: organizationId,
      member_id: memberId,
      subject,
      message,
      attachment_paths: attachmentPaths,
    });

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSubject("");
    setMessage("");
    setFiles([]);
    setSent(true);
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Request support</h2>
        <p className={styles.helperText}>
          The more detail you give us, the faster we can help. Try to include: what you were
          trying to do, what happened instead, and the steps that led up to it. Screenshots make
          a big difference — attach as many as you need.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="subject">
            Subject
          </label>
          <input
            id="subject"
            className={styles.input}
            required
            placeholder="Short summary of the issue"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="message">
            What&apos;s going on?
          </label>
          <textarea
            id="message"
            className={styles.textarea}
            required
            placeholder="What were you trying to do? What happened instead? Any steps to reproduce it?"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="attachments">
            Screenshots <span className={styles.hint}>(optional)</span>
          </label>
          <input
            id="attachments"
            type="file"
            accept="image/*"
            multiple
            className={styles.input}
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
          {files.length > 0 && (
            <p className={styles.hint}>
              {files.length} file{files.length === 1 ? "" : "s"} selected
            </p>
          )}
        </div>
        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
            {loading ? "Sending…" : "Send request"}
          </button>
        </div>
        {sent && (
          <p className={styles.helperText}>Your request was sent — we&apos;ll follow up by email.</p>
        )}
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </form>
    </div>
  );
}
