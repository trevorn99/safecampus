"use client";

import { useState, type FormEvent } from "react";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };
type Role = "org_admin" | "location_manager" | "team_lead" | "member";

export function InviteForm({
  organizationId,
  locations,
  teams,
}: {
  organizationId: string;
  locations: Option[];
  teams: Option[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [scopeId, setScopeId] = useState("");

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError("");

    const scopeType = role === "org_admin" ? "org" : role === "location_manager" ? "location" : "team";
    const resolvedScopeId = role === "org_admin" ? organizationId : scopeId || organizationId;

    const response = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        email,
        name,
        role,
        scopeType: role === "member" && !scopeId ? "org" : scopeType,
        scopeId: role === "member" && !scopeId ? organizationId : resolvedScopeId,
      }),
    });

    if (response.ok) {
      setStatus("sent");
      return;
    }
    const body = await response.json().catch(() => ({}));
    setStatus("error");
    setError(body.error ?? "Something went wrong");
  }

  if (status === "sent") {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.badge}>Invite sent</span>
          <h1 className={styles.cardTitle}>You&apos;re done</h1>
          <p className={styles.subtitle}>{email} will receive an email with a sign-in link.</p>
        </div>
        <a href="/team" className={styles.link}>
          ← Back to team roster
        </a>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h1 className={styles.cardTitle}>Invite a team member</h1>
        <p className={styles.subtitle}>They&apos;ll get an email with a sign-in link.</p>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="name">
            Name
          </label>
          <input
            id="name"
            className={styles.input}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className={styles.input}
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="role">
            Role
          </label>
          <select
            id="role"
            className={styles.select}
            value={role}
            onChange={(event) => {
              setRole(event.target.value as Role);
              setScopeId("");
            }}
          >
            <option value="member">Member</option>
            <option value="team_lead">Team lead</option>
            <option value="location_manager">Location manager</option>
            <option value="org_admin">Org admin</option>
          </select>
        </div>
        {role === "location_manager" && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="scope">
              Location
            </label>
            <select
              id="scope"
              className={styles.select}
              required
              value={scopeId}
              onChange={(event) => setScopeId(event.target.value)}
            >
              <option value="">Select a location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {(role === "team_lead" || role === "member") && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="scope">
              Team {role === "member" && <span className={styles.hint}>(optional)</span>}
            </label>
            <select
              id="scope"
              className={styles.select}
              required={role === "team_lead"}
              value={scopeId}
              onChange={(event) => setScopeId(event.target.value)}
            >
              <option value="">{role === "member" ? "No specific team" : "Select a team"}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="submit"
          className={`${styles.button} ${styles.buttonPrimary}`}
          disabled={status === "sending"}
        >
          {status === "sending" ? "Sending…" : "Send invite"}
        </button>
        {status === "error" && <p className={styles.errorText}>{error}</p>}
      </form>
    </div>
  );
}
