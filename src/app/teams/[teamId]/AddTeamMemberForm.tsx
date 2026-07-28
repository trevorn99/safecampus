"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Member = { id: string; name: string };

export function AddTeamMemberForm({ teamId, members }: { teamId: string; members: Member[] }) {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");
  const [role, setRole] = useState<"member" | "team_lead">("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!memberId) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.from("role_assignments").insert({
      member_id: memberId,
      scope_type: "team",
      scope_id: teamId,
      role,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMemberId("");
    setRole("member");
    router.refresh();
  }

  if (members.length === 0) {
    return <p className={styles.helperText}>Everyone in the organization is already assigned to this team.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="addMember">
          Add existing member
        </label>
        <select
          id="addMember"
          className={styles.select}
          required
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
        >
          <option value="">Select a member</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="addRole">
          Role on this team
        </label>
        <select
          id="addRole"
          className={styles.select}
          value={role}
          onChange={(event) => setRole(event.target.value as "member" | "team_lead")}
        >
          <option value="member">Member</option>
          <option value="team_lead">Team lead</option>
        </select>
      </div>
      <div className={styles.actions}>
        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
          {loading ? "Adding…" : "Add to team"}
        </button>
      </div>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </form>
  );
}
