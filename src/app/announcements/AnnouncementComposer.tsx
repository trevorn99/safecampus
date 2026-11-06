"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

type Team = { id: string; name: string };
type Audience = "organization" | "teams" | "team_leads";
type Preview = { recipients: number; emails: number; texts: number; smsEnabled: boolean };

// Org admins choose between everyone, selected teams and the team leads;
// location managers and team leads only ever see the teams they may
// address. The reach shown under the audience comes from the same server
// code that sends, so "Reaches 18 people" is exactly who gets it.
export function AnnouncementComposer({ isOrgAdmin, teams }: { isOrgAdmin: boolean; teams: Team[] }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>(isOrgAdmin ? "organization" : "teams");
  const [teamIds, setTeamIds] = useState<string[]>(!isOrgAdmin && teams.length === 1 ? [teams[0].id] : []);
  const [sendText, setSendText] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  const needsTeams = audience === "teams" && teamIds.length === 0;

  useEffect(() => {
    if (needsTeams) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audience, teamIds, preview: true }),
        });
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        if (response.ok && data) {
          setPreview(data as Preview);
          setPreviewFailed(false);
        } else {
          setPreviewFailed(true);
        }
      } catch {
        if (!cancelled) setPreviewFailed(true);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audience, teamIds, needsTeams]);

  function toggleTeam(id: string) {
    setTeamIds((current) => (current.includes(id) ? current.filter((t) => t !== id) : [...current, id]));
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (needsTeams) {
      setError("Choose at least one team.");
      return;
    }
    const reach = preview?.recipients ?? 0;
    const textNote = sendText && preview?.texts ? `, ${preview.texts} of them by text too` : "";
    if (!window.confirm(`Send “${subject.trim()}” to ${reach} ${reach === 1 ? "person" : "people"}${textNote}?`)) return;

    setBusy(true);
    setError("");
    setSent("");
    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, audience, teamIds, sendText }),
      });
      const data: { error?: string; recipients?: number; emailCount?: number; smsCount?: number } = await response
        .json()
        .catch(() => ({}));
      setBusy(false);
      if (!response.ok) {
        setError(data.error ?? "Something went wrong — please try again.");
        return;
      }
      setSent(
        `Sent to ${data.recipients} ${data.recipients === 1 ? "person" : "people"}: ${data.emailCount} by email` +
          (sendText ? `, ${data.smsCount} by text.` : "."),
      );
      setSubject("");
      setBody("");
      setSendText(false);
      router.refresh();
    } catch {
      setBusy(false);
      setError("Something went wrong — please check your connection and try again.");
    }
  }

  return (
    <form onSubmit={send} className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>New announcement</h2>
        <p className={styles.helperText}>
          Emailed to everyone you choose, whatever their reminder settings, and shown on their dashboard until they
          dismiss it. Replies come straight to you.
        </p>
      </div>

      <div className={styles.form}>
        <div className={styles.field}>
          <span className={styles.label}>Send to</span>
          {isOrgAdmin && (
            <div className={styles.tagRow}>
              {(
                [
                  ["organization", "Everyone"],
                  ["teams", "Selected teams"],
                  ["team_leads", "Team leads"],
                ] as [Audience, string][]
              ).map(([value, label]) => (
                <label key={value} className={styles.checkboxRow}>
                  <input
                    type="radio"
                    name="audience"
                    checked={audience === value}
                    onChange={() => setAudience(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
          {audience === "teams" && (
            <div className={styles.tagRow}>
              {teams.map((team) => (
                <label key={team.id} className={styles.checkboxRow}>
                  <input type="checkbox" checked={teamIds.includes(team.id)} onChange={() => toggleTeam(team.id)} />
                  {team.name}
                </label>
              ))}
            </div>
          )}
          <p className={styles.hint}>
            {needsTeams
              ? "Choose at least one team."
              : previewFailed
                ? "Couldn't count who this reaches — you can still send it."
                : preview
                  ? `Reaches ${preview.recipients} ${preview.recipients === 1 ? "person" : "people"} who have joined SafeCampus.`
                  : "Counting…"}
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="announcement-subject">
            Subject
          </label>
          <input
            id="announcement-subject"
            className={styles.input}
            required
            maxLength={150}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="announcement-body">
            Message
          </label>
          <textarea
            id="announcement-body"
            className={styles.textarea}
            required
            rows={7}
            maxLength={5000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>

        {preview?.smsEnabled ? (
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={sendText} onChange={(event) => setSendText(event.target.checked)} />
            Also text it to the {preview.texts} {preview.texts === 1 ? "person" : "people"} who opted in to texts
            <span className={styles.hint}>(a short version with a link to the full message)</span>
          </label>
        ) : (
          preview && <p className={styles.hint}>Texting is switched off for your organization, so this goes by email only.</p>
        )}

        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || needsTeams}>
            {busy ? "Sending…" : "Send announcement"}
          </button>
        </div>
        {sent && <p className={styles.hint}>{sent}</p>}
        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
