"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { centeredStyle, formStyle, errorStyle } from "@/lib/ui";

type Option = { id: string; name: string };
type Role = "org_admin" | "location_manager" | "team_lead" | "member";

export default function InviteTeamMemberPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Option[]>([]);
  const [teams, setTeams] = useState<Option[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [scopeId, setScopeId] = useState("");

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("members")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!member) return;

      setOrganizationId(member.organization_id);
      const [{ data: locs }, { data: tms }] = await Promise.all([
        supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
        supabase.from("teams").select("id, name").eq("organization_id", member.organization_id),
      ]);
      setLocations(locs ?? []);
      setTeams(tms ?? []);
    }
    load();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;

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
      <main style={centeredStyle}>
        <h1>Invite sent</h1>
        <p>{email} will receive an email with a sign-in link.</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  return (
    <main style={centeredStyle}>
      <h1>Invite a team member</h1>
      <form onSubmit={handleSubmit} style={formStyle}>
        <label>
          Name
          <input required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Email
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => { setRole(event.target.value as Role); setScopeId(""); }}>
            <option value="member">Member</option>
            <option value="team_lead">Team lead</option>
            <option value="location_manager">Location manager</option>
            <option value="org_admin">Org admin</option>
          </select>
        </label>
        {role === "location_manager" && (
          <label>
            Location
            <select required value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
              <option value="">Select a location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </label>
        )}
        {(role === "team_lead" || role === "member") && (
          <label>
            Team {role === "member" ? "(optional)" : ""}
            <select required={role === "team_lead"} value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
              <option value="">{role === "member" ? "No specific team" : "Select a team"}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" disabled={status === "sending" || !organizationId}>
          {status === "sending" ? "Sending…" : "Send invite"}
        </button>
        {status === "error" && <p style={errorStyle}>{error}</p>}
      </form>
    </main>
  );
}
