# SafeCampus

Team management, scheduling, and notifications for church safety teams — rosters, location-scoped roles, certification and training tracking, secure document and watchlist storage, Planning Center import, and automated reminders via SendGrid and Twilio.

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

## Branches

- `main` — tracks the production Supabase project and Vercel production deploy.
- `dev` — tracks the development Supabase project and Vercel preview deploys.

Nothing reaches `main` without going through `dev` first.
