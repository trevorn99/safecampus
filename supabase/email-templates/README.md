# Auth email templates

**The app no longer depends on these.** Sign-in codes are minted and mailed
by the app itself (`src/lib/signInCode.ts`, via `/api/auth/send-code`) over
the same SendGrid call as every other email, and invitations come from
`src/lib/inviteEmail.ts` and carry no code at all — the invitee asks for one
from the sign-in page when they're ready. Nothing in SafeCampus calls
Supabase's `signInWithOtp` any more.

These templates are what Supabase sends if something does go through it: an
invite sent by hand from the Supabase dashboard, or a sign-in triggered
outside the app. Keep them pasted in each project so that mail still looks
like SafeCampus and still carries a code rather than a link, but nothing a
member does in the app reaches them.

They are a deliberate copy of `renderBrandedEmail()` in `src/lib/email.ts`,
and the code box matches `codeBlockHtml()` there.

## Codes, not links

Sign-in is a 6-digit code the person types on `/login`. Emailed links were
single-use credentials, and mail filters such as Proofpoint open every link
in a message to inspect it, so a link could be spent before its recipient
clicked it. A code has to be read and typed by a person.

That only works if **the email contains no link carrying the same
credential**. A sign-in link and a code are the same one-time token, so a
scanner opening the link spends the code too. These templates show
`{{ .Token }}` as text and use neither `{{ .ConfirmationURL }}` nor
`{{ .TokenHash }}`. Don't add either back.

`{{ .Token }}` is display text, never an `href`. `<a href="{{ .Token }}">`
renders as `<a href="482913">` — a link to a page named after the code,
which goes nowhere.

## Applying them

Supabase dashboard → Authentication → Emails → Templates, once per project
(dev and prod are separate, with separate template settings):

| File | Template | Suggested subject |
| --- | --- | --- |
| `magic-link.html` | Magic Link | `Your SafeCampus sign-in code` |
| `confirm-signup.html` | Confirm signup | `Confirm your email for SafeCampus` |
| `invite.html` | Invite user | `You've been invited to SafeCampus` |

Paste the file's whole contents into the message body; subjects are set in
the same screen.

Pasting them is now optional — the app's own mail doesn't use them — but
recommended, so that anything Supabase does send carries a code, not a link.

### Settings that go with it

- **Site URL** (Authentication → URL Configuration): `https://www.safecampus.net`
  for production, `https://dev.safecampus.net` for dev. The logo and the
  dashboard invite's button are built from it.
- **Email OTP expiration** (Authentication → Providers → Email): how long a
  code works, including the app's own codes. The default of one hour is
  right: a code is now requested at the moment it's needed, and
  invitations don't carry one, so nothing has to survive overnight.
- **Email OTP length**: the page and the templates say "6-digit". If this is
  changed, change the copy in `src/app/login/page.tsx` and here.

## Deliverability

These were rewritten after Proofpoint classified invitations as junk. What
mattered, in rough order: saying who invited the recipient and what
SafeCampus is rather than "you've been invited, click here"; naming the
sender and the organisation in the footer with guidance for someone who
wasn't expecting it; and a real plain-text alternative carrying the same
content.

Supabase sends these over SMTP, so SendGrid's **account-level click
tracking** rewrites links in them to `*.ct.sendgrid.net` redirects. With
codes instead of sign-in links that no longer endangers the credential, but
it still puts an unfamiliar domain under every link in the message — turn
it off under Settings > Tracking > Click Tracking. The app's own mail
disables it per message.

## Notes

- **`{{ .Data.organization_name }}`** in `invite.html` comes from the `data`
  passed to `generateLink` in `src/lib/inviteEmail.ts`. It is wrapped in
  `{{ if }}` so an invite sent any other way still renders.
- **Old links still work.** `/auth/confirm` verifies the token-hash links
  sent before the switch, so nothing already in someone's inbox breaks.
- Password reset and reauthentication templates are deliberately absent —
  there are no passwords in this app.
