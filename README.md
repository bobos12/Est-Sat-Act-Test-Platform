# 16hundred — EST examination platform

Commercial EST I preparation platform: public site and exam library, a timed examination engine,
and a private admin dashboard. Next.js 16 (App Router, Cache Components) + Supabase (Postgres, Auth, Storage).

- Blueprint derived from the source papers: [`docs/EST_BLUEPRINT.md`](docs/EST_BLUEPRINT.md)
- Database: [`supabase/migrations`](supabase/migrations)

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Inspect project & source materials | ✅ |
| 2 | Schema, security, auth, brand foundation | ✅ |
| 3 | Public website & exam library | ✅ |
| 4 | Examination engine (timer, autosave, resume, grading, results) | ✅ |
| 5 | Admin dashboard, students, exams editor, knowledge base | ✅ (needs live admin test) |
| 6 | AI exam generation → review → publish | ✅ (needs `ANTHROPIC_API_KEY`) |
| 7 | Plans, Paymob checkout, verified webhooks, renewals | ✅ (needs Paymob keys + sandbox test) |
| 8 | End-to-end testing | in progress — see "Launch checklist" |

## Setup

### 1. Create a Supabase project
1. Sign up at supabase.com and create a project (region: closest to Egypt, e.g. Frankfurt / `eu-central-1`).
2. **Project Settings → API**: copy the Project URL, `anon` key and `service_role` key.

### 2. Apply the database
Either with the Supabase CLI:
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```
…or paste each file in `supabase/migrations/` into **SQL Editor** in filename order.

### 3. Environment
```bash
cp .env.example .env.local   # then fill in the three Supabase values
npm install
npm run dev
```

### 4. Create the first administrator
Sign up through the site, then run once in the SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
After that, admins manage roles from the dashboard (every change is written to the audit log).

### 5. Auth URLs
**Authentication → URL Configuration**: set **Site URL** to your domain (e.g. `https://16hundred.app`) and add
`http://localhost:3000/**` to Redirect URLs for local development. The default confirmation email works as is.
Optionally, for links that also work across devices, change **Email Templates → Confirm signup** to:
```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
```

### 6. Scheduled jobs (recommended)
**Database → Extensions → enable `pg_cron`**, then:
```sql
select cron.schedule('close-expired-attempts', '* * * * *', 'select public.close_expired_attempts()');
select cron.schedule('expire-subscriptions', '*/15 * * * *', 'select public.expire_subscriptions()');
```
Access checks never depend on these jobs — they only tidy statuses.

## Launch checklist

1. **Your admin account** — sign up on the site, confirm the email, then in Supabase SQL Editor:
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
2. **Supabase service role key** → `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (needed for payments).
3. **AI** → `ANTHROPIC_API_KEY`. Then: Admin → Knowledge base → upload each EST paper *and* its answer key
   (link the key to its paper) → open the paper → *Analyse with AI*. Then Admin → Generate exams.
4. **Paymob** (sandbox first) → the five `PAYMOB_*` values. Create a plan in Admin → Plans & payments.
   The webhook URL is sent automatically with every checkout: `<NEXT_PUBLIC_SITE_URL>/api/webhooks/paymob`
   — it must be publicly reachable (deploy, or use a tunnel for local testing).
5. **Deploy** (e.g. Vercel): set all env vars, set `NEXT_PUBLIC_SITE_URL` to the real domain, and add it to
   Supabase → Authentication → URL Configuration.
6. Optional: enable `pg_cron` and schedule the two jobs in "Scheduled jobs" below.

## Admin dashboard (`/admin`)

| Area | What it does |
|---|---|
| Overview | Students, active/expired subscriptions, published exams, attempts, revenue, payment outcomes |
| Exams | Create, edit details, add/edit/reorder questions with live preview and image upload, shared passages/tables, preview with answer key, approve, publish / unpublish / archive. Published exams are locked against edits. |
| Generate exams | Subject, topics/domains, question count, difficulty mix, duration, number of exams → drafts in review. A second independent AI pass flags any answer key it disagrees with. |
| Knowledge base | Upload official PDFs (private, de-duplicated by hash, never overwritten), analyse paper + answer key together, review extracted questions |
| Students | Search/filter, profile with attempts, subscriptions, payments; grant/revoke premium and change role — every action in the audit log |
| Plans & payments | Create/edit plans and prices, payment history with filters, subscriptions, webhook problems |

## Architecture notes

- **Answer keys never reach the browser.** Students cannot read `questions`, `question_options` or
  `exam_questions` (RLS). The exam screen loads through `get_attempt_payload`, which strips correct answers.
- **The database clock is the exam clock.** `start_attempt` sets `deadline_at`; `save_answer` and
  `submit_attempt` reject or expire work after the deadline (+15 s network grace). Refreshing resumes the
  same open attempt.
- **Official source papers are reference material.** Questions with `origin = 'source'` can't be added to
  student exams; they feed analysis and AI generation only.
- **Knowledge base is append-only.** Source documents can't be deleted or have their file replaced, and
  duplicate uploads are rejected by file hash.
- **Nothing AI-generated is published automatically.** Publishing requires every question to be
  `approved` with exactly one correct option (enforced in the database).
- **Payments** (Phase 7) are confirmed only by verified webhooks recorded in `payment_events`, never by a
  browser redirect.
- Admin routes are gated server-side (`requireAdmin`) *and* by RLS.

## Testing the database

Requires a local Postgres 16:
```bash
PGHOST=localhost PGUSER=postgres supabase/tests/run.sh
```
Applies all migrations to a scratch database with Supabase auth stubs and runs 56 checks covering
permissions, answer-key privacy, resume, server-side expiry, grading, access grants and audit,
payment idempotency, tampered amounts, renewals, and the published-content lock.
