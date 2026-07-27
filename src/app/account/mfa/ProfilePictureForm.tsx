"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ORG_FILES_BUCKET, orgFilePath } from "@/lib/supabase/storage";
import { Avatar } from "@/components/Avatar";
import { AvatarCropper } from "./AvatarCropper";
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) setPendingFile(file);
  }

  async function handleCropped(blob: Blob) {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const path = orgFilePath(organizationId, "avatars", "avatar.png");
    const { error: uploadError } = await supabase.storage
      .from(ORG_FILES_BUCKET)
      .upload(path, blob, { contentType: "image/png" });
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
    setPendingFile(null);
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

      {pendingFile ? (
        <AvatarCropper file={pendingFile} onCancel={() => setPendingFile(null)} onSave={handleCropped} />
      ) : (
        <div className={styles.identityRow}>
          <Avatar name={name} url={currentUrl} size="lg" />
          <div className={styles.field}>
            <input
              type="file"
              accept="image/*"
              className={styles.input}
              disabled={loading}
              onChange={handleSelect}
            />
            {loading && <p className={styles.hint}>Uploading…</p>}
          </div>
        </div>
      )}
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </div>
  );
}
