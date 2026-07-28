import { SiteHeader } from "@/components/SiteHeader";
import styles from "@/styles/ui.module.css";

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.legalMain}>
        <div>
          <h1>Terms of Service</h1>
          <p className={styles.helperText}>Last updated: August 5, 2026</p>
        </div>

        <p>
          These Terms of Service (&quot;Terms&quot;) govern access to and use of SafeCampus (the
          &quot;Service&quot;), operated by SafeCampus (&quot;we,&quot; &quot;us&quot;). By creating
          an organization, accepting an invitation to join one, or otherwise using the Service, you
          agree to these Terms on behalf of yourself and, if applicable, the organization you
          represent. This is a draft starting point for our own legal review, not a finished legal
          instrument.
        </p>

        <h2>1. Who may use the Service</h2>
        <p>
          You must be at least 18 years old and able to form a binding contract to create an
          organization on SafeCampus. If you&apos;re joining an organization someone else created,
          your access is subject to whatever role that organization&apos;s admin assigns you, and to
          these Terms.
        </p>

        <h2>2. Accounts</h2>
        <p>
          Sign-in is passwordless (a one-time email link) or via Google OAuth — there&apos;s no
          password to keep secret, but you&apos;re responsible for keeping access to your email
          account and any device you&apos;ve enrolled for two-factor authentication or marked as
          trusted. Notify us promptly if you believe your account has been compromised. Organization
          admins are responsible for the accuracy of role assignments they make within their
          organization.
        </p>

        <h2>3. Subscriptions & billing</h2>
        <p>
          New organizations get a 14-day free trial. After the trial, continued access requires an
          active subscription, billed at a flat rate based on your organization&apos;s active member
          count; your plan upgrades automatically as your roster grows past a tier&apos;s cap.
          Payment is processed by Stripe; by subscribing, you authorize us to charge your payment
          method on a recurring basis until you cancel. Subscriptions can be managed or canceled at
          any time from within the Service. Fees are non-refundable except where required by law or
          expressly stated otherwise. We may change our pricing prospectively, with notice.
        </p>

        <h2>4. Your organization&apos;s data</h2>
        <p>
          As between you and us, your organization owns the data it puts into SafeCampus — member
          records, schedules, certifications, watchlist and incident entries, and everything else
          your organization creates (&quot;Customer Data&quot;). You grant us a limited license to
          host, process, and display Customer Data solely to provide the Service to your
          organization. We don&apos;t use Customer Data to train third-party AI models or sell it to
          third parties.
        </p>

        <h2>5. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service to violate any applicable law, or the rights of any person, including privacy and data protection laws applicable to information you enter about individuals (including non-users, in watchlist or incident records).</li>
          <li>Attempt to access data belonging to another organization, or to circumvent the Service&apos;s access controls.</li>
          <li>Interfere with or disrupt the integrity or performance of the Service, including through unauthorized automated access.</li>
          <li>Upload malicious code, or content you don&apos;t have the right to upload (e.g. certification documents belonging to someone else without authorization).</li>
          <li>Use SMS notifications to send messages to a number without that person&apos;s consent.</li>
        </ul>

        <h2>6. Third-party integrations</h2>
        <p>
          SafeCampus supports optional integrations with third-party services, currently Planning
          Center. Each organization connects and controls its own Planning Center OAuth application
          and credentials; we are not responsible for the availability, accuracy, or content of data
          in your organization&apos;s connected third-party account. Disconnecting an integration is
          available at any time from within the Service.
        </p>

        <h2>7. Platform support access</h2>
        <p>
          To provide support, SafeCampus platform administrators may request temporary, time-boxed
          access to an organization&apos;s account, with a logged reason. Your organization&apos;s
          admins can see active support-access grants and revoke them at any time. Platform
          administrators do not otherwise have standing access to organization data.
        </p>

        <h2>8. SMS notifications</h2>
        <p>
          If your organization enables SMS notifications, you&apos;re responsible for obtaining
          consent from members before entering their phone numbers for that purpose. Members can opt
          out of SMS at any time by replying STOP or through their account settings. Message and
          data rates may apply.
        </p>

        <h2>9. Disclaimers</h2>
        <p>
          SafeCampus is a coordination, scheduling, and record-keeping tool for safety and security
          teams. <strong>It is not a substitute for your organization&apos;s own safety judgment,
          policies, training, or emergency procedures, and it does not guarantee any safety
          outcome.</strong> Watchlist and incident-report features help your organization keep a
          record — they do not verify, investigate, or corroborate the accuracy of anything entered
          into them; that responsibility rests with your organization. THE SERVICE IS PROVIDED
          &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING
          WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
        </p>

        <h2>10. Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, SAFECAMPUS WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, REVENUE, OR
          PROFITS, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE
          POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS
          OR THE SERVICE WILL NOT EXCEED THE AMOUNT YOUR ORGANIZATION PAID US IN THE 12 MONTHS
          BEFORE THE CLAIM AROSE.
        </p>

        <h2>11. Indemnification</h2>
        <p>
          Your organization agrees to indemnify and hold SafeCampus harmless from any claim arising
          out of Customer Data, your organization&apos;s use of the Service in violation of these
          Terms or applicable law, or your organization&apos;s collection or handling of information
          about third parties (including watchlist or incident subjects) through the Service.
        </p>

        <h2>12. Termination</h2>
        <p>
          You may stop using the Service and cancel your subscription at any time. We may suspend or
          terminate access to the Service for any organization or user that violates these Terms,
          or, on reasonable notice, for any other reason. Upon termination, your right to use the
          Service ends; provisions of these Terms that by their nature should survive (including
          Sections 9–11) will survive.
        </p>

        <h2>13. Changes to the Service or these Terms</h2>
        <p>
          We may modify the Service over time, and may update these Terms. If we make material
          changes, we&apos;ll update the &quot;Last updated&quot; date and, where appropriate, notify
          organization admins directly. Continued use of the Service after changes take effect
          constitutes acceptance of the updated Terms.
        </p>

        <h2>14. Governing law</h2>
        <p>
          These Terms are governed by the laws of the United States and the state in which
          SafeCampus is organized, without regard to conflict-of-laws principles, unless applicable
          law requires otherwise.
        </p>

        <h2>15. Contact us</h2>
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:legal@safecampus.net">legal@safecampus.net</a>, or submitted through the
          in-app support form if you already have an account.
        </p>
      </main>
    </>
  );
}
