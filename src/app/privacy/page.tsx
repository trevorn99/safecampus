import { SiteHeader } from "@/components/SiteHeader";
import styles from "@/styles/ui.module.css";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.legalMain}>
        <div>
          <h1>Privacy Policy</h1>
          <p className={styles.helperText}>Last updated: August 5, 2026</p>
        </div>

        <p>
          This Privacy Policy explains how SafeCampus (&quot;SafeCampus,&quot; &quot;we,&quot;
          &quot;us&quot;) collects, uses, and shares information when an organization
          (&quot;Customer&quot;) and its members use our team-management platform for safety and
          security teams (the &quot;Service&quot;). It&apos;s written for the people actually using
          SafeCampus, and it&apos;s a draft starting point for our own legal review, not a finished
          legal instrument — treat it as a foundation for counsel to refine, not a substitute for
          that review.
        </p>

        <h2>1. Who this applies to</h2>
        <p>
          SafeCampus is used by organizations (churches, schools, venues, and other safety/security
          teams) and the individual members of those organizations — admins, location managers,
          team leads, and members. Each organization&apos;s data is isolated from every other
          organization&apos;s at the database level; nothing described here changes that.
        </p>

        <h2>2. Information we collect</h2>
        <p>
          <strong>Account information.</strong> When you sign in, we (via our authentication
          provider) collect your email address and, if you use Google sign-in, basic profile
          information from Google. We don&apos;t store passwords — sign-in is passwordless (a
          one-time email link) or via Google OAuth.
        </p>
        <p>
          <strong>Profile and membership information.</strong> Name, email, phone number, and an
          optional profile picture; which organization, locations, and teams you belong to; and
          your role(s).
        </p>
        <p>
          <strong>Two-factor authentication data.</strong> If you enroll in MFA, our authentication
          provider stores a TOTP secret or a WebAuthn/passkey public key on our behalf. We never
          see or store your private key or biometric data — that stays on your device, by design
          of the WebAuthn standard.
        </p>
        <p>
          <strong>Scheduling data.</strong> Events, positions, assignments, and your
          confirm/decline responses.
        </p>
        <p>
          <strong>Certifications and compliance records.</strong> Certification types, dates, and
          any files you or your organization upload; background check status and provider
          information, where your organization uses that feature.
        </p>
        <p>
          <strong>Safety-specific records.</strong> If your organization uses watchlist or incident
          reporting, those records may include information about individuals who are{" "}
          <strong>not</strong> SafeCampus users — for example, a name, description, and reason
          entered by your organization about someone of concern. See Section 9.
        </p>
        <p>
          <strong>Support requests.</strong> Anything you submit through our support form,
          including optional screenshots.
        </p>
        <p>
          <strong>Payment information.</strong> Billing is handled by Stripe. We do not store your
          card number — Stripe provides us a customer/subscription reference and billing history.
        </p>
        <p>
          <strong>Communications data.</strong> If your organization enables SMS notifications, we
          collect the mobile number you provide and message delivery status. See Section 5 for how
          SMS consent works.
        </p>
        <p>
          <strong>Third-party integration data.</strong> If your organization connects Planning
          Center, we store the resulting OAuth access/refresh tokens and the calendar event data
          you choose to import. See Section 8.
        </p>
        <p>
          <strong>Usage and device data.</strong> Standard web server logs (IP address, browser
          type, pages visited, timestamps) collected automatically by our hosting provider.
        </p>

        <h2>3. How we use information</h2>
        <ul>
          <li>To provide, maintain, and secure the Service, including authenticating you and enforcing your organization&apos;s access boundaries.</li>
          <li>To operate features you or your organization use — scheduling, certifications, maps, billing, integrations.</li>
          <li>To send account, security, and service-related communications (e.g. sign-in links, MFA prompts, invite emails, event reminders).</li>
          <li>To respond to support requests.</li>
          <li>To detect, investigate, and prevent fraud, abuse, and security incidents.</li>
          <li>To comply with legal obligations.</li>
        </ul>
        <p>We do not sell personal information, and we do not use your data to train third-party AI models.</p>

        <h2>4. How we share information</h2>
        <p>
          <strong>Within your organization.</strong> Role-based access controls determine what
          other members of your own organization can see — for example, org admins and location
          managers see more than a general member.
        </p>
        <p>
          <strong>Service providers (subprocessors).</strong> We use the following providers to
          operate SafeCampus, each bound by their own data protection terms:
        </p>
        <ul>
          <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
          <li><strong>Vercel</strong> — application hosting.</li>
          <li><strong>Stripe</strong> — payment processing.</li>
          <li><strong>SendGrid</strong> — transactional email delivery.</li>
          <li><strong>SignalWire</strong> — SMS delivery, where your organization enables it.</li>
        </ul>
        <p>
          <strong>Planning Center.</strong> If your organization connects its own Planning Center
          account, data flows directly between your organization&apos;s Planning Center account and
          SafeCampus under credentials your organization controls and can revoke at any time. See
          Section 8.
        </p>
        <p>
          <strong>Platform support access.</strong> SafeCampus staff do not have standing access to
          your organization&apos;s data. Support access is granted only through a self-service,
          time-boxed, reason-logged mechanism your own organization admins can see and revoke at any
          time — see Section 10.
        </p>
        <p>
          <strong>Legal requirements.</strong> We may disclose information if required by law, or
          in a good-faith belief that disclosure is necessary to protect the rights, property, or
          safety of SafeCampus, our users, or the public.
        </p>
        <p>
          <strong>Business transfers.</strong> If SafeCampus is involved in a merger, acquisition,
          or sale of assets, information may be transferred as part of that transaction, subject to
          this policy or a policy at least as protective.
        </p>

        <h2>5. SMS / text messaging</h2>
        <p>
          Where your organization enables SMS notifications (e.g. schedule reminders,
          certification-expiry alerts), we only send text messages to a phone number after the
          person associated with that number has opted in. Consent to receive SMS is not a
          condition of using SafeCampus generally — organizations and members can rely on email and
          in-app notifications instead.
        </p>
        <ul>
          <li>Message frequency varies based on your organization&apos;s scheduling activity.</li>
          <li>Message and data rates may apply.</li>
          <li>Reply <strong>STOP</strong> at any time to opt out of SMS; reply <strong>HELP</strong> for help.</li>
          <li>We do not share your phone number with third parties for their own marketing purposes.</li>
        </ul>

        <h2>6. Data security</h2>
        <p>
          Every organization&apos;s data is isolated using database-level row-level security, not
          just application-level checks. Sensitive tables (background checks, watchlist entries)
          have additional access restrictions. We support and, for admin/location-manager roles,
          require multi-factor authentication (authenticator app or passkey). Support access from
          our own staff is audited and time-limited rather than standing. No method of transmission
          or storage is perfectly secure, and we can&apos;t guarantee absolute security.
        </p>

        <h2>7. Data retention</h2>
        <p>
          We retain personal information for as long as your organization&apos;s account is active,
          and for a reasonable period afterward to comply with legal obligations, resolve disputes,
          and enforce our agreements. Your organization&apos;s admins can delete specific records
          (members, certifications, positions, etc.) directly within the Service. Deleting an
          organization&apos;s account is handled by contacting us — see Section 14.
        </p>

        <h2>8. Third-party integrations</h2>
        <p>
          SafeCampus&apos;s Planning Center integration is opt-in and per-organization: each
          organization registers and controls its own Planning Center OAuth application and can
          disconnect it at any time, which stops any further data exchange. Importing a calendar
          event into SafeCampus does not happen automatically — an organization admin reviews and
          selects which events to bring in.
        </p>

        <h2>9. Information about non-users</h2>
        <p>
          Certain features — watchlist entries and incident reports — may involve information about
          individuals who are not SafeCampus users and have not created an account (for example, a
          person an organization has flagged as a safety concern). This information is entered and
          controlled by the organization using the Service, not by SafeCampus, and is subject to
          additional access restrictions (including a step-up authentication requirement for
          watchlist data). Organizations are responsible for ensuring their own collection and use
          of this information about third parties complies with applicable law. If you believe
          information about you has been entered into such a record and would like to make a
          request regarding it, see Section 14 — we will route your request to the relevant
          organization, since SafeCampus does not control that content.
        </p>

        <h2>10. Platform support access</h2>
        <p>
          SafeCampus platform administrators do not have standing, always-on access to any
          organization&apos;s data. When support is needed, a platform administrator can request
          time-boxed access (1, 4, or 24 hours) to a specific organization, with a required reason
          on record. That request is visible to the organization, and any organization admin can
          revoke it early. This is a deliberate design choice, not a limitation we&apos;re disclosing
          reluctantly.
        </p>

        <h2>11. Children&apos;s privacy</h2>
        <p>
          SafeCampus is intended for use by adults administering or serving on a safety/security
          team, not for use by children. We do not knowingly collect personal information directly
          from children under 13. If your organization&apos;s use of watchlist, incident, or other
          records incidentally references a minor (for example, in an incident report), that
          information is controlled by your organization as described in Section 9.
        </p>

        <h2>12. Your choices and rights</h2>
        <p>
          You can review and update your own profile information, manage your MFA methods, and
          manage SMS opt-in/opt-out directly within the Service. For requests to access, correct,
          or delete personal information beyond what&apos;s self-service in the app, contact us
          using the information in Section 14 — we&apos;ll work with your organization&apos;s admin
          where the data is under their control. Depending on your location, you may have
          additional rights under laws like the GDPR or CCPA/CPRA; we&apos;ll honor valid requests
          under those laws to the extent they apply.
        </p>

        <h2>13. Changes to this policy</h2>
        <p>
          We may update this policy as SafeCampus changes. If we make material changes, we&apos;ll
          update the &quot;Last updated&quot; date above and, where appropriate, notify organization
          admins directly.
        </p>

        <h2>14. Contact us</h2>
        <p>
          Questions about this policy, or requests regarding your personal information, can be sent
          to <a href="mailto:privacy@safecampus.net">privacy@safecampus.net</a>, or submitted through
          the in-app support form if you already have an account.
        </p>
      </main>
    </>
  );
}
