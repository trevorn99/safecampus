import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { getAvatarUrlMap } from "@/lib/avatars";
import { AssignmentStatusButtons } from "../AssignmentStatusButtons";
import { AddPositionForm } from "./AddPositionForm";
import { AssignMemberForm } from "./AssignMemberForm";
import { RemoveAssignmentButton } from "./RemoveAssignmentButton";
import { DeletePositionButton } from "./DeletePositionButton";
import { PositionHeader } from "./PositionHeader";
import styles from "@/styles/ui.module.css";

const TYPE_LABEL: Record<string, string> = {
  service: "Service",
  drill: "Drill",
  meeting: "Meeting",
};

type AssignmentRow = { id: string; member_id: string; status: string; event_position_id: string };

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const [{ data: event }, { data: locations }, { data: teams }, { data: positions }, { data: orgMembers }, { data: teamAssignments }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, title, start_time, type, location_id, series_id")
        .eq("id", eventId)
        .maybeSingle(),
      supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
      supabase.from("teams").select("id, name").eq("organization_id", member.organization_id),
      supabase
        .from("event_positions")
        .select("id, title, team_id, location_id, start_time, end_time, slots, template_position_id")
        .eq("event_id", eventId)
        .order("start_time"),
      supabase
        .from("members")
        .select("id, name, profile_picture_url")
        .eq("organization_id", member.organization_id)
        .order("name"),
      supabase.from("role_assignments").select("member_id, scope_id").eq("scope_type", "team"),
    ]);

  if (!event) {
    return (
      <>
        <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
        <main className={styles.appMain}>
          <p className={styles.helperText}>Event not found.</p>
          <Link href="/schedule" className={styles.link}>
            ← Back to schedule
          </Link>
        </main>
      </>
    );
  }

  const positionIds = (positions ?? []).map((p) => p.id);
  let assignments: AssignmentRow[] = [];
  if (positionIds.length > 0) {
    const { data } = await supabase
      .from("assignments")
      .select("id, member_id, status, event_position_id")
      .in("event_position_id", positionIds);
    assignments = data ?? [];
  }

  const locationName = new Map((locations ?? []).map((l) => [l.id, l.name]));
  const memberById = new Map((orgMembers ?? []).map((m) => [m.id, m]));
  const avatarUrls = await getAvatarUrlMap(supabase, (orgMembers ?? []).map((m) => m.profile_picture_url));

  const teamMemberIds = new Map<string, Set<string>>();
  for (const row of teamAssignments ?? []) {
    const set = teamMemberIds.get(row.scope_id) ?? new Set<string>();
    set.add(row.member_id);
    teamMemberIds.set(row.scope_id, set);
  }

  const assignmentsByPosition = new Map<string, AssignmentRow[]>();
  for (const assignment of assignments) {
    const list = assignmentsByPosition.get(assignment.event_position_id) ?? [];
    list.push(assignment);
    assignmentsByPosition.set(assignment.event_position_id, list);
  }

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>{event.title}</h1>
          <p className={styles.subtitle}>
            {organizationName} · {TYPE_LABEL[event.type] ?? event.type} ·{" "}
            {new Date(event.start_time).toLocaleString()} ·{" "}
            {event.location_id ? (locationName.get(event.location_id) ?? "Unknown location") : "Org-wide"}
          </p>
        </div>

        {(positions ?? []).length === 0 && (
          <p className={styles.helperText}>No positions have been added to this event yet.</p>
        )}

        {(positions ?? []).map((position) => {
          const positionAssignments = assignmentsByPosition.get(position.id) ?? [];
          const assignedMemberIds = new Set(positionAssignments.map((a) => a.member_id));
          const eligiblePool = position.team_id
            ? (orgMembers ?? []).filter((m) => teamMemberIds.get(position.team_id!)?.has(m.id))
            : (orgMembers ?? []);
          const eligibleMembers = eligiblePool.filter((m) => !assignedMemberIds.has(m.id));

          const metaText = [
            new Date(position.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) +
              (position.end_time
                ? ` – ${new Date(position.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : ""),
            position.team_id ? (teams?.find((t) => t.id === position.team_id)?.name ?? "Unknown team") : null,
            position.location_id ? (locationName.get(position.location_id) ?? "Unknown location") : null,
            `${positionAssignments.length} of ${position.slots} filled`,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div key={position.id} className={styles.card}>
              {isAdmin ? (
                <PositionHeader
                  position={position}
                  metaText={metaText}
                  teams={teams ?? []}
                  locations={locations ?? []}
                  seriesId={event.series_id}
                />
              ) : (
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>{position.title}</h2>
                  <p className={styles.itemMeta}>{metaText}</p>
                </div>
              )}

              <ul className={styles.list}>
                {positionAssignments.map((assignment) => {
                  const assignedMember = memberById.get(assignment.member_id);
                  const avatarUrl = assignedMember?.profile_picture_url
                    ? (avatarUrls.get(assignedMember.profile_picture_url) ?? null)
                    : null;
                  return (
                    <li key={assignment.id} className={styles.listRow}>
                      <div className={styles.identityRow}>
                        <Avatar name={assignedMember?.name ?? "?"} url={avatarUrl} />
                        <p className={styles.itemName}>{assignedMember?.name ?? "Unknown member"}</p>
                      </div>
                      <div className={styles.tagRow}>
                        {assignment.member_id === member.id ? (
                          <AssignmentStatusButtons assignmentId={assignment.id} status={assignment.status} />
                        ) : (
                          <span className={styles.pillMuted}>{assignment.status}</span>
                        )}
                        {isAdmin && (
                          <RemoveAssignmentButton
                            assignmentId={assignment.id}
                            name={assignedMember?.name ?? "this member"}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {isAdmin && positionAssignments.length < position.slots && (
                <AssignMemberForm positionId={position.id} eligibleMembers={eligibleMembers} />
              )}
              {isAdmin && <DeletePositionButton positionId={position.id} title={position.title} />}
            </div>
          );
        })}

        {isAdmin && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Add a position</h2>
            </div>
            <AddPositionForm
              eventId={event.id}
              eventStartTime={event.start_time}
              teams={teams ?? []}
              locations={locations ?? []}
            />
          </div>
        )}

        <Link href="/schedule" className={styles.link}>
          ← Back to schedule
        </Link>
      </main>
    </>
  );
}
