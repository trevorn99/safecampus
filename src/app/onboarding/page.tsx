"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { centeredStyle, formStyle, errorStyle } from "@/lib/ui";

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.rpc("create_organization_with_admin", {
      p_org_name: orgName,
      p_admin_name: adminName,
      p_timezone: timezone,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main style={centeredStyle}>
      <h1>Set up your organization</h1>
      <p>You&apos;ll be the first admin — you can invite the rest of your team next.</p>
      <form onSubmit={handleSubmit} style={formStyle}>
        <label>
          Organization name
          <input
            required
            placeholder="Grace Community Church"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
          />
        </label>
        <label>
          Your name
          <input required value={adminName} onChange={(event) => setAdminName(event.target.value)} />
        </label>
        <label>
          Timezone
          <input required value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create organization"}
        </button>
        {error && <p style={errorStyle}>{error}</p>}
      </form>
    </main>
  );
}
