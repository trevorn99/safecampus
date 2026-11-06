"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

// Removing someone from the organization, in all three of the shapes that
// takes: cancelling an invitation that hasn't been accepted, deleting a
// roster entry that was never invited, and removing an active member.
//
// The confirmation says what is actually lost, because the three are not
// equally serious. Cancelling an unaccepted invite throws away almost
// nothing; removing an active member deletes their certifications,
// training, background checks and attendance history along with them, and
// an admin who expects "remove from this organization" to mean "revoke
// access" would not guess that.
export function RemoveMemberButton({
  memberId,
  name,
  status,
  invited,
  isSelf,
  compact = false,
}: {
  memberId: string;
  name: string;
  status: string;
  /** Has an account, so an invitation has gone out. */
  invited: boolean;
  /** This is the signed-in admin's own roster entry. */
  isSelf: boolean;
  /** Smaller, for the roster's action cluster. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pending = status === "pending";
  const label = pending && invited ? "Cancel invite" : "Remove";

  function confirmText() {
    if (pending && invited) {
      return `Cancel the invite for ${name}? Their roster entry goes too, along with anything they are scheduled for.`;
    }
    if (pending) {
      return `Remove ${name} from the roster? Any positions they are assigned to will be unfilled.`;
    }
    const consequences =
      `Remove ${name} from this organization?\n\n` +
      `This deletes their roster entry, their certifications, training and background check records, ` +
      `their attendance history, and everything they are scheduled for. Incident reports and documents ` +
      `they filed stay, without their name attached.`;
    return isSelf
      ? `${consequences}\n\nThis is your own account — you will lose access to this organization immediately.`
      : consequences;
  }

  async function handleRemove() {
    if (!window.confirm(confirmText())) return;
    setLoading(true);
    setError("");

    let response: Response;
    let data: { error?: string; self?: boolean } = {};
    try {
      response = await fetch("/api/team/remove-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
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

    // Removing yourself leaves this page showing an organization you are no
    // longer part of, so hand the routing decision back to the server.
    if (data.self) {
      router.replace("/dashboard");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}${compact ? ` ${styles.buttonCompact}` : ""}`}
        disabled={loading}
        onClick={handleRemove}
      >
        {loading ? "Removing…" : label}
      </button>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
