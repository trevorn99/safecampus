import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Sign-in and registration figures for Analytics. Who joined comes from the
// roster; when they were invited, accepted and last signed in comes from
// Supabase Auth through org_member_auth_summary(); day-by-day sign-ins come
// from member_sign_ins, which only has history from when tracking began.

const DAY_MS = 24 * 60 * 60 * 1000;

export type RegistrationStage = "joined" | "invited" | "not_invited";

export type PersonRow = {
  id: string;
  name: string;
  stage: RegistrationStage;
  invitedAt: string | null;
  joinedAt: string | null;
  lastSignInAt: string | null;
  signInsInWindow: number;
  hasMfa: boolean;
};

export type PeopleStats = {
  rosterSize: number;
  stages: Record<RegistrationStage, number>;
  activeLast7: number;
  activeLast30: number;
  /** Median days from invitation to acceptance, where both are known. */
  medianDaysToAccept: number | null;
  /** Days the oldest still-unanswered invitation has been waiting. */
  oldestPendingDays: number | null;
  mfaEnabled: number;
  emailReminders: number;
  smsReminders: number;
  dailySignIns: { day: string; count: number }[];
  signInsByMethod: Record<"email_code" | "email_link" | "google", number>;
  trackingSince: string | null;
  people: PersonRow[];
};

/** YYYY-MM-DD for an instant, on the organization's calendar. */
function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function getPeopleStats(
  supabase: SupabaseClient,
  organizationId: string,
  timeZone: string,
  windowDays: number,
): Promise<PeopleStats> {
  const now = Date.now();
  const windowStart = new Date(now - windowDays * DAY_MS);

  const [{ data: members }, { data: auth }, { data: signIns }, { data: firstSignIn }] = await Promise.all([
    supabase
      .from("members")
      .select("id, name, status, user_id, email_opt_in, sms_opt_in")
      .eq("organization_id", organizationId),
    supabase.rpc("org_member_auth_summary", { target_org: organizationId }),
    supabase
      .from("member_sign_ins")
      .select("member_id, method, signed_in_at")
      .eq("organization_id", organizationId)
      .gte("signed_in_at", windowStart.toISOString()),
    supabase
      .from("member_sign_ins")
      .select("signed_in_at")
      .eq("organization_id", organizationId)
      .order("signed_in_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  type AuthRow = {
    member_id: string;
    invited_at: string | null;
    confirmed_at: string | null;
    last_sign_in_at: string | null;
    has_mfa: boolean;
  };
  const authByMember = new Map(((auth ?? []) as AuthRow[]).map((row) => [row.member_id, row]));

  const signInCount = new Map<string, number>();
  const signInsByMethod = { email_code: 0, email_link: 0, google: 0 };
  const perDay = new Map<string, number>();
  for (const row of signIns ?? []) {
    signInCount.set(row.member_id, (signInCount.get(row.member_id) ?? 0) + 1);
    if (row.method in signInsByMethod) signInsByMethod[row.method as keyof typeof signInsByMethod] += 1;
    const key = dayKey(new Date(row.signed_in_at), timeZone);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  // Every day in the window, including the empty ones — a gap is
  // information, and a chart that skips it would compress quiet weeks out of
  // existence.
  const dailySignIns: { day: string; count: number }[] = [];
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const key = dayKey(new Date(now - i * DAY_MS), timeZone);
    if (!dailySignIns.some((d) => d.day === key)) dailySignIns.push({ day: key, count: perDay.get(key) ?? 0 });
  }

  const people: PersonRow[] = (members ?? []).map((member) => {
    const row = authByMember.get(member.id);
    // "Joined" follows the roster's own status, which flips when someone
    // first signs in; pending with an account means an invitation is out.
    const stage: RegistrationStage =
      member.status !== "pending" ? "joined" : member.user_id ? "invited" : "not_invited";
    return {
      id: member.id,
      name: member.name,
      stage,
      invitedAt: row?.invited_at ?? null,
      joinedAt: stage === "joined" ? (row?.confirmed_at ?? null) : null,
      lastSignInAt: row?.last_sign_in_at ?? null,
      signInsInWindow: signInCount.get(member.id) ?? 0,
      hasMfa: Boolean(row?.has_mfa),
    };
  });

  const stages = { joined: 0, invited: 0, not_invited: 0 };
  for (const person of people) stages[person.stage] += 1;

  const within = (iso: string | null, days: number) => iso !== null && now - new Date(iso).getTime() <= days * DAY_MS;
  const joinedPeople = people.filter((p) => p.stage === "joined");

  const acceptDays = people
    .filter((p) => p.invitedAt && p.joinedAt && p.stage === "joined")
    .map((p) => (new Date(p.joinedAt!).getTime() - new Date(p.invitedAt!).getTime()) / DAY_MS)
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);
  const medianDaysToAccept =
    acceptDays.length === 0
      ? null
      : acceptDays.length % 2
        ? acceptDays[(acceptDays.length - 1) / 2]
        : (acceptDays[acceptDays.length / 2 - 1] + acceptDays[acceptDays.length / 2]) / 2;

  const pendingInvites = people.filter((p) => p.stage === "invited" && p.invitedAt);
  const oldestPendingDays =
    pendingInvites.length === 0
      ? null
      : Math.floor(Math.max(...pendingInvites.map((p) => now - new Date(p.invitedAt!).getTime())) / DAY_MS);

  const optIns = new Map((members ?? []).map((m) => [m.id, m]));

  // Sorted for chasing people up: never-signed-in and longest-quiet first
  // among those who joined, then outstanding invitations, then the rest.
  const stageOrder: Record<RegistrationStage, number> = { joined: 0, invited: 1, not_invited: 2 };
  people.sort((a, b) => {
    if (a.stage !== b.stage) return stageOrder[a.stage] - stageOrder[b.stage];
    const aTime = a.lastSignInAt ? new Date(a.lastSignInAt).getTime() : -Infinity;
    const bTime = b.lastSignInAt ? new Date(b.lastSignInAt).getTime() : -Infinity;
    return aTime - bTime || a.name.localeCompare(b.name);
  });

  return {
    rosterSize: people.length,
    stages,
    activeLast7: joinedPeople.filter((p) => within(p.lastSignInAt, 7)).length,
    activeLast30: joinedPeople.filter((p) => within(p.lastSignInAt, 30)).length,
    medianDaysToAccept,
    oldestPendingDays,
    mfaEnabled: joinedPeople.filter((p) => p.hasMfa).length,
    emailReminders: joinedPeople.filter((p) => optIns.get(p.id)?.email_opt_in).length,
    smsReminders: joinedPeople.filter((p) => optIns.get(p.id)?.sms_opt_in).length,
    dailySignIns,
    signInsByMethod,
    trackingSince: firstSignIn?.signed_in_at ?? null,
    people,
  };
}
