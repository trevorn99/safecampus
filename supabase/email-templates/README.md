# Auth email templates

Supabase Auth sends the sign-in links and invitations — not this app — so
these templates can't come from `src/lib/email.ts` like the shift reminder
does. They live here as the source of truth, and are **pasted into each
Supabase project's dashboard by hand**.

They are a deliberate copy of `renderBrandedEmail()` in `src/lib/email.ts`.
Changing the look in one place means changing it in the other; there is no
build step that keeps them in sync, because the dashboard is on the far
side of a process boundary.

## Applying them

Supabase dashboard → Authentication → Emails → Templates, once per project
(dev and prod are separate databases with separate template settings):

| File | Template |
| --- | --- |
| `magic-link.html` | Magic Link |
| `invite.html` | Invite user |
| `confirm-signup.html` | Confirm signup |

Paste the file's whole contents into the message body. Subjects are set
separately in the same screen; the app doesn't control them.

## Deliverability

These were rewritten after Proofpoint classified invitations as junk. What
mattered, in rough order: saying who invited the recipient and what
SafeCampus is rather than "you've been invited, click here"; a specific
call to action instead of a bare "Accept invitation"; naming the sender and
the organisation in the footer with guidance for someone who wasn't
expecting it; and a real plain-text alternative carrying the same content.

One part cannot be fixed from this repo. Supabase sends these over SMTP, so
SendGrid applies **account-level click tracking**, rewriting every link to a
`*.ct.sendgrid.net` redirect — an unrecognisable domain under an "accept your
invitation" button, which is exactly what filters weigh. Turn it off in
SendGrid under Settings > Tracking > Click Tracking, or configure a branded
link domain (`link.safecampus.net`) so the redirect at least belongs to you.
The app's own mail disables it per message and is unaffected either way.

## Notes

- **The logo URL is absolute** (`https://safecampus.net/images/logo-mark.png`)
  and hardcoded. Supabase renders these outside any request, so there is no
  origin to derive it from — which also means a dev-project invite shows the
  production logo. That's fine, and better than a broken image.
- **`{{ .Data.organization_name }}`** in `invite.html` comes from the
  `data` passed to `inviteUserByEmail` in `/api/team/invite` and
  `/api/team/send-invite`. It is wrapped in `{{ if }}` so an invite sent
  any other way still renders.
- **`confirm-signup.html`** is included for completeness. Sign-in is
  passwordless, so most accounts are created through the magic link or an
  invitation and never see it.
- Password reset and reauthentication templates are deliberately absent —
  there are no passwords in this app.
