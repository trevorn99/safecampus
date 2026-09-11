"use client";

import styles from "@/styles/ui.module.css";

export type PostOption = { id: string; name: string; locationName: string };

// Optional everywhere, permanently. A staffing requirement like "Roam" or
// "Camera" isn't a fixed place, and forcing one would make the model lie.
// Options carry their location because a template can be used at more than
// one campus, and two campuses can each have a Lobby.
export function PostSelect({
  id,
  value,
  posts,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  posts: PostOption[];
  onChange: (postId: string) => void;
  disabled?: boolean;
}) {
  if (posts.length === 0) return null;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        Post <span className={styles.hint}>(optional — where on the map this stands)</span>
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Not a fixed place</option>
        {posts.map((post) => (
          <option key={post.id} value={post.id}>
            {post.name} — {post.locationName}
          </option>
        ))}
      </select>
    </div>
  );
}
