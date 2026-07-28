import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Verified against Planning Center's actual OAuth/API docs before writing
// this (their doc site is a JS SPA that doesn't respond to plain fetches,
// so this went through their search-indexed content instead).
const AUTHORIZE_URL = "https://api.planningcenteronline.com/oauth/authorize";
const TOKEN_URL = "https://api.planningcenteronline.com/oauth/token";
const API_BASE = "https://api.planningcenteronline.com";
const SCOPE = "calendar";
// 5-minute buffer before real expiry (access tokens last 2 hours) so a
// request never races a token that's about to expire mid-flight.
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

type AppCredentials = { clientId: string; clientSecret: string };

// Each org registers its own PCO OAuth app — see the migration comment for
// why. This is the only place those credentials get read from storage.
export async function getAppCredentials(organizationId: string): Promise<AppCredentials | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pco_app_credentials")
    .select("client_id, client_secret")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data ? { clientId: data.client_id, clientSecret: data.client_secret } : null;
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
};

async function requestTokens(credentials: AppCredentials, body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      ...body,
    }),
  });
  if (!response.ok) {
    throw new Error(`Planning Center token request failed: ${await response.text()}`);
  }
  return response.json();
}

export async function exchangeCodeForTokens(
  credentials: AppCredentials,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  return requestTokens(credentials, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

async function getValidAccessToken(organizationId: string): Promise<string | null> {
  const admin = createAdminClient();
  const [{ data: connection }, credentials] = await Promise.all([
    admin
      .from("pco_connections")
      .select("access_token, refresh_token, expires_at")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    getAppCredentials(organizationId),
  ]);
  if (!connection || !credentials) return null;

  if (new Date(connection.expires_at).getTime() - EXPIRY_BUFFER_MS > Date.now()) {
    return connection.access_token;
  }

  const refreshed = await requestTokens(credentials, {
    grant_type: "refresh_token",
    refresh_token: connection.refresh_token,
  });
  await admin
    .from("pco_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      scope: refreshed.scope,
    })
    .eq("organization_id", organizationId);
  return refreshed.access_token;
}

// The top-level Event resource carries no date/time itself — Planning
// Center splits an event's metadata (name, approval status) from its actual
// scheduled occurrences, which live on the separate EventInstance resource
// (one per calendar occurrence, so a recurring PCO event naturally yields
// one instance per occurrence — confirmed against a real connected account
// before writing this, not assumed). Each instance carries its own `name`
// too, so no extra lookup back to the parent Event is needed.
type PcoEventInstancesResponse = {
  data: Array<{ id: string; attributes: { name: string; starts_at: string } }>;
  links?: { next?: string };
};

// Stages candidates in pco_imported_events — deliberately does NOT create
// SafeCampus events directly. Not every church calendar entry needs a
// safety team presence; an admin selectively promotes one via
// /schedule/new, which is the only path that ever writes to `events`.
export async function importPcoEvents(organizationId: string): Promise<{ imported: number }> {
  const accessToken = await getValidAccessToken(organizationId);
  if (!accessToken) {
    throw new Error("Planning Center is not connected for this organization");
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  // filter=future is a documented PCO filter on this resource; the client-
  // side check below is just a belt-and-suspenders backstop in case its
  // exact boundary differs from "now".
  let url: string | undefined =
    `${API_BASE}/calendar/v2/event_instances?per_page=100&filter=future&order=starts_at`;
  let imported = 0;

  while (url) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      throw new Error(`Planning Center events request failed: ${await response.text()}`);
    }
    const body: PcoEventInstancesResponse = await response.json();

    const upcoming = body.data.filter((instance) => instance.attributes.starts_at >= nowIso);
    if (upcoming.length > 0) {
      const { error } = await admin.from("pco_imported_events").upsert(
        upcoming.map((instance) => ({
          organization_id: organizationId,
          pco_event_id: instance.id,
          title: instance.attributes.name,
          starts_at: instance.attributes.starts_at,
        })),
        { onConflict: "organization_id,pco_event_id" },
      );
      if (!error) imported += upcoming.length;
    }

    url = body.links?.next;
  }

  return { imported };
}
