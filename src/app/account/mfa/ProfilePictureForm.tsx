"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ORG_FILES_BUCKET, orgFilePath } from "@/lib/supabase/storage";
import { Avatar } from "@/components/Avatar";
import styles from "@/styles/ui.module.css";

export function ProfilePictureForm({
  memberId,
  organizationId,
  name,
  currentUrl,
}: {
  memberId: string;
  organizationId: string;
  name: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    const path = orgFilePath(organizationId, "avatars", file.name);
    const { error: uploadError } = await supabase.storage.from(ORG_FILES_BUCKET).upload(path, file);
    if (uploadError) {
      setLoading(false);
      setError(uploadError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("members")
      .update({ profile_picture_url: path })
      .eq("id", memberId);

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Profile picture</h2>
        <p className={styles.helperText}>Visible to your teammates so they can recognize you.</p>
      </div>
      <div className={styles.identityRow}>
        <Avatar name={name} url={currentUrl} size="lg" />
        <div className={styles.field}>
          <input
            type="file"
            accept="image/*"
            className={styles.input}
            disabled={loading}
            onChange={handleChange}
          />
          {loading && <p className={styles.hint}>Uploading…</p>}
        </div>
      </div>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </div>
  );
}
