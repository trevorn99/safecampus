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
