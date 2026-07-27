# SafeCampus

Team management, scheduling, and notifications for safety teams and organizations of every kind — rosters, location-scoped roles, certification and training tracking, secure document and watchlist storage, Planning Center import, and automated reminders via SendGrid and Twilio.

The full architecture and data model are documented in the project's architecture brief (Supabase/Postgres, Next.js, RLS design, platform admin support access, dev/prod environments).

## Stack

- **Frontend**: Next.js (App Router, TypeScript)
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)
- **Notifications**: SendGrid (email), Twilio (SMS)
- **Calendar source**: Planning Center API

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL and publishable key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

Schema and Row Level Security policies live in `supabase/migrations/` as versioned SQL, applied with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Apply migrations to the dev project first, verify, then promote the same files to prod.

### Automated migrations (GitHub Actions)

`.github/workflows/supabase-migrate.yml` runs `supabase db push` on every push to `dev` or `main`, targeting a different Supabase project per branch via GitHub Environments. To activate it:

1. In the repo's Settings → Environments, create two environments: `dev` and `production`.
2. In each, add secrets `SUPABASE_PROJECT_ID` (Settings → General → Reference ID in that Supabase project) and `SUPABASE_DB_PASSWORD` (the database password set when the project was created).
3. Add a repository-level secret `SUPABASE_ACCESS_TOKEN` (Supabase account → Access Tokens) — this one's account-scoped, not project-scoped, so it's shared across both environments.
4. Optional but recommended before this touches real data: add a required-reviewer protection rule to the `production` environment, so a push to `main` pauses for approval before the migration actually runs.

Until these secrets exist, the workflow will run and fail harmlessly on push — it doesn't block anything else in CI.

## Branches

- `main` — tracks the production Supabase project and Vercel production deploy.
- `dev` — tracks the development Supabase project and Vercel preview deploys.

Nothing reaches `main` without going through `dev` first.
