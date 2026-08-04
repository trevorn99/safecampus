import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import styles from "@/styles/ui.module.css";

const SECTIONS = [
  { id: "roles", label: "Roles & permissions" },
  { id: "teams", label: "Teams" },
  { id: "scheduling", label: "Scheduling" },
  { id: "certifications", label: "Certifications" },
  { id: "locations", label: "Locations & maps" },
  { id: "analytics", label: "Analytics" },
  { id: "account", label: "Account & security" },
  { id: "integrations", label: "Planning Center" },
  { id: "threat-intelligence", label: "Threat Intelligence" },
  { id: "identity-verification", label: "Identity verification" },
  { id: "billing", label: "Billing" },
  { id: "support", label: "Getting help" },
];

export default async function HelpPage() {
  const { organizationName, isAdmin, isPlatformAdmin } = await requireMembership({ allowUnpaid: true });

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Help & documentation</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        <div className={styles.card}>
          <div className={styles.tagRow}>
            {SECTIONS.map((section) => (
              <a key={section.id} href={`#${section.id}`} className={styles.pillMuted}>
                {section.label}
              </a>
            ))}
          </div>
        </div>

        <div id="roles" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Roles & permissions</h2>
          </div>
          <ul className={styles.docList}>
            <li><strong>Org admin</strong> — full access across the whole organization: every location, team, and setting, including billing and the audit log.</li>
            <li><strong>Location manager</strong> — full access scoped to one location: its teams, events, and roster.</li>
            <li><strong>Team lead</strong> — assigned within a specific team, mainly for visibility into who&apos;s on that team.</li>
            <li><strong>Member</strong> — the default role: see the schedule, manage your own certifications and assignments.</li>
          </ul>
          <p className={styles.docBody}>
            A person can hold different roles in different places — org admin everywhere, or a location
            manager at one campus and a plain member elsewhere. Roles are set when inviting someone from{" "}
            <strong>Team → Invite a team member</strong>, and org admins/location managers are required to
            enroll in two-factor authentication before they can use their elevated access.
          </p>
        </div>

        <div id="teams" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Teams</h2>
          </div>
          <p className={styles.docBody}>
            Teams group members for scheduling — e.g. &quot;Medical&quot; or &quot;Parking.&quot; Create one
            from <strong>Teams → New team</strong>, optionally scoped to a specific location. From a team&apos;s
            page you can rename it, add or remove members (as team lead or member), and delete it — deleting
            a team removes everyone&apos;s assignment to it but doesn&apos;t touch anything else.
          </p>
          <p className={styles.docBody}>
            The team roster (<strong>Team</strong> in the nav) is organized by team, so you can see at a
            glance who&apos;s on each one — anyone on more than one team shows up in each. Admins can also add
            or remove someone from any team directly from their row on the roster, via{" "}
            <strong>Manage teams</strong> — no need to visit each team&apos;s own page.
          </p>
          <p className={styles.docBody}>
            From a team&apos;s own page, an admin can set required certifications or trainings for that team
            under <strong>Requirements</strong>. Certification requirements are checked automatically against
            each member&apos;s certifications on file, so it&apos;s easy to see who&apos;s missing what right on
            the team roster; training requirements are tracked as policy for now, without automatic checking.
          </p>
        </div>

        <div id="scheduling" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Scheduling</h2>
          </div>
          <p className={styles.docBody}>
            <strong>Events</strong> are created from <strong>Schedule → New event</strong>. Add positions
            right there — a title, an optional team, a time offset from the event&apos;s start (negative
            values work too, e.g. -15 for &quot;15 minutes early&quot;), and how many people are needed. You
            can optionally save those positions as a reusable <strong>template</strong> so the next similar
            event starts pre-filled.
          </p>
          <p className={styles.docBody}>
            For events that repeat, set <strong>Repeats</strong> to Weekly or Monthly right on that same
            form. Weekly supports an interval (every N weeks) plus specific days; Monthly supports an
            ordinal weekday like &quot;the 1st Sunday&quot; — these aren&apos;t the same thing: every 4 weeks
            drifts relative to the calendar over a year, monthly-by-ordinal doesn&apos;t. A series can be
            paused, resumed, or deleted from <strong>Schedule → Recurring series</strong> — deleting one
            only stops future generation, it doesn&apos;t remove events already created.
          </p>
          <p className={styles.docBody}>
            On an event&apos;s page, admins assign members to open positions (only members on that
            position&apos;s team are offered, if it has one) and can edit a position after the fact. If it
            came from a template and its event is part of a series, there&apos;s an option to apply a
            title/team/location/slots change to every event in that series at once. Everyone sees their own
            assignments at the top of <strong>Schedule</strong> and on the dashboard calendar, with buttons
            to confirm or decline.
          </p>
          <p className={styles.docBody}>
            Events have their own type — Service, Drill, Meeting, and Training by default — and an admin can
            add, rename, or remove types from <strong>Schedule → Event types</strong> to match how your
            organization actually runs. An event can also carry an end time alongside its start (for a
            recurring series, this comes from the series&apos; duration instead). For a training, use the{" "}
            <strong>Attendance</strong> section on that event&apos;s page to check members in and out — a
            simple record of who actually showed up, separate from who was scheduled.
          </p>
        </div>

        <div id="certifications" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Certifications</h2>
          </div>
          <p className={styles.docBody}>
            Members upload their own certifications from the <strong>Certifications</strong> page — type,
            issue/expiration dates, and an optional file. Admins can see and track everyone&apos;s across
            the organization from the same page. See <strong>Teams</strong> for how a team can require
            specific certifications from its members.
          </p>
        </div>

        <div id="locations" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Locations & maps</h2>
          </div>
          <p className={styles.docBody}>
            Admins manage locations from the <strong>Locations</strong> page. Each location can have a map
            image uploaded, with position pins placed directly on it so new volunteers can see exactly where
            a position stands.
          </p>
        </div>

        {isAdmin && (
          <div id="analytics" className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Analytics</h2>
            </div>
            <p className={styles.docBody}>
              <strong>Analytics</strong> gives org admins a read on how the team&apos;s actually running: events
              by type over the last 90 days, scheduling fill rate by week, attendance record counts, and
              certifications expiring in the next 30 days.
            </p>
          </div>
        )}

        <div id="account" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Account & security</h2>
          </div>
          <p className={styles.docBody}>
            From <strong>Account</strong>, everyone can set a profile picture (with a zoom/pan cropper) and
            manage two-factor authentication: an authenticator app (TOTP) or a passkey (Face ID, Touch ID,
            Windows Hello, or a security key) — you can enroll both. At sign-in, checking &quot;don&apos;t
            ask again on this device for 30 days&quot; skips the prompt on that device going forward; it can
            be undone for all devices at once from the same Account page.
          </p>
          <p className={styles.docBody}>
            From the same page, members can opt in to SMS shift reminders — a text 3 days and 24 hours before
            an assigned shift — if your organization has turned them on. Org admins turn SMS reminders on or
            off for the whole organization from <strong>Account → Security &amp; MFA</strong> as well.
          </p>
        </div>

        <div id="integrations" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Planning Center</h2>
          </div>
          <p className={styles.docBody}>
            From <strong>Schedule → Integrations</strong>, connect your organization&apos;s own Planning
            Center account (you register a small OAuth app in your Planning Center account — the exact steps
            and redirect URL are shown right on that page). Once connected, &quot;Check for new events&quot;
            pulls in upcoming Planning Center calendar events as a list — nothing is added to your schedule
            automatically. Pick which ones actually need a safety team presence and create a SafeCampus event
            from each one you choose.
          </p>
        </div>

        <div id="threat-intelligence" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Threat Intelligence</h2>
          </div>
          <p className={styles.docBody}>
            If your organization has the Threat Intelligence add-on enabled (see <strong>Billing</strong>),{" "}
            <strong>Threat Intelligence</strong> in the nav shows one AI-drafted brief covering every location
            combined — recent incident and watchlist activity, public web search, X/Twitter search, and
            government advisories (DHS, FBI/CISA) — refreshed weekly or on demand, with your org context
            factored in. A report moves through draft → reviewed → released; org admins can see it at every
            stage, and team leads can see it once it&apos;s released. It&apos;s a starting point, not a
            replacement for your team&apos;s own human intelligence — some platforms (private Facebook
            groups, Instagram, TikTok) simply can&apos;t be monitored through an API.
          </p>
        </div>

        <div id="identity-verification" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Identity verification</h2>
          </div>
          <p className={styles.docBody}>
            If your organization has the Identity Verification add-on enabled (see <strong>Billing</strong>),
            every non-admin member must verify their identity — a government-issued photo ID plus a live
            selfie, through Stripe&apos;s hosted flow — before they can use the rest of the app. Verify from{" "}
            <strong>Account → Identity verification</strong>; SafeCampus never sees or stores the document
            itself, and status updates automatically, usually within a few minutes. Org admins are exempt from
            the requirement, so enabling it can never lock an admin out of turning it back off.
          </p>
        </div>

        {isAdmin && (
          <div id="billing" className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Billing</h2>
            </div>
            <p className={styles.docBody}>
              SafeCampus has three flat-rate plans based on active member count, with a 14-day trial for new
              organizations. Manage your subscription, see billing history, and download invoices from{" "}
              <strong>Billing</strong>. Your plan upgrades automatically as your roster grows past a cap.
            </p>
          </div>
        )}

        <div id="support" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Getting help</h2>
          </div>
          <p className={styles.docBody}>
            If something isn&apos;t covered here, use <strong>Support</strong> in the nav to send a request —
            include what you were trying to do, what happened instead, and a screenshot if you have one. Your
            org admin can see the status of every request your organization has sent.
          </p>
        </div>
      </main>
    </>
  );
}
