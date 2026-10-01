# Scheduled Email Application

A full-stack app for scheduling emails to be sent at a future date and time. Users log in, compose an email, pick a date/time, and watch it move through `scheduled → processing → sent / failed`. Scheduled emails **survive server restarts** because PostgreSQL is the source of truth and BullMQ/Redis only executes the schedule.

## 1. Project overview

| Layer | What it does |
| --- | --- |
| **Frontend** (Next.js) | Login/register, dashboard with Scheduled and Sent tabs, compose form |
| **API** (Express) | Auth, validation, stores emails in PostgreSQL, creates BullMQ delayed jobs, returns immediately |
| **Worker** (BullMQ) | Separate process; picks up due jobs and sends through Nodemailer |
| **PostgreSQL** | Permanent record of users and emails (source of truth) |
| **Redis + BullMQ** | Job scheduling/execution layer (delayed jobs, retries, throughput limit) |
| **Ethereal** | Fake SMTP inbox for development: nothing is delivered to real people |

## 2. Features

- Register, login, logout, JWT-protected routes (frontend and backend)
- Compose with recipient, subject, message, date and time (past times rejected on client and server)
- "Send in 1 / 2 / 5 min" shortcuts on the compose form for quick demos
- Dashboard tabs: **Scheduled Emails** and **Sent Emails**; click a row for full details
- Statuses: `scheduled`, `processing`, `sent`, `failed` (failed rows show the error)
- Loading, empty and error states; success/error toasts; submit button disabled while submitting
- Dashboard refreshes itself every 10 seconds so status changes appear without reloading
- Restart-safe scheduling with startup and periodic reconciliation
- Retries with exponential backoff, idempotent worker, configurable concurrency
- API rate limiting (global, login/register, per-user scheduling) and a Redis-backed email throughput limit
- Backend tests (26) with mocked Redis/SMTP, strict TypeScript, ESLint

## 3. Tech stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, native `fetch`
- **Backend:** Node.js, Express 4, TypeScript, Zod, JWT (`jsonwebtoken`), `bcryptjs`, Helmet, CORS, `express-rate-limit`
- **Data:** PostgreSQL 16 (plain SQL migrations, `pg`), Redis 7
- **Queue:** BullMQ
- **Email:** Nodemailer + Ethereal SMTP
- **Infra:** Docker Compose for PostgreSQL and Redis only (the apps run directly on your machine)
- **Tests:** Vitest, Supertest, pg-mem (in-memory Postgres for tests)

## 4. Architecture

```
Next.js (browser)
   |  HTTPS/JSON + JWT
   v
Express API ──────────────► PostgreSQL   (source of truth: users, emails, status)
   |
   | add delayed job  (jobId = email-<emailId>, delay = scheduledAt - now)
   v
Redis ◄──── BullMQ queue "email-queue"
   |
   v
Worker process (separate: npm run worker)
   |  1. claim email: UPDATE ... SET status='processing' WHERE status='scheduled'
   |  2. send
   v
Nodemailer ──► Ethereal SMTP
   |
   v
Worker updates PostgreSQL: status = sent (sent_at) or failed (error_message)

Reconciler (runs in API and worker at startup, and in the worker every 60s):
   PostgreSQL "scheduled" rows  ──►  make sure each has a BullMQ job
```

Flow when a user schedules an email:

1. `POST /api/emails/schedule` validates the body (Zod) and rejects past times.
2. The email is saved in PostgreSQL with status `scheduled`.
3. A BullMQ delayed job `email-<id>` is added to Redis with `delay = scheduledAt − now`.
4. The API responds `201` immediately. It never waits for SMTP.
5. When the delay elapses, the worker claims the row, sends the email, and records `sent` or `failed`.

## 5. Folder structure

```
scheduled-email-app/
├── docker-compose.yml          PostgreSQL + Redis
├── package.json                convenience scripts that proxy to backend/frontend
├── README.md
├── backend/
│   ├── migrations/001_init.sql users + emails tables and indexes
│   ├── scripts/                createEtherealAccount.ts, loadDemo.ts
│   ├── src/
│   │   ├── config/env.ts       validated environment variables
│   │   ├── controllers/        auth + email request handlers
│   │   ├── db/                 pool, migration runner, seed, repositories, mappers
│   │   ├── middleware/         authenticate, error handler, rate limiters
│   │   ├── queues/             Redis connection + email queue (enqueue, job state)
│   │   ├── routes/             /api/auth, /api/emails
│   │   ├── services/           auth, email, mail (Nodemailer), reconciliation
│   │   ├── types/              shared backend types
│   │   ├── utils/              errors, logger, asyncHandler
│   │   ├── validators/         Zod schemas
│   │   ├── workers/            processor (job logic), worker setup, entry point
│   │   ├── app.ts              Express app factory
│   │   └── server.ts           API entry point
│   └── tests/                  auth, emails, worker, reconciliation tests
└── frontend/
    └── src/
        ├── app/                /login, /register, (app)/dashboard, (app)/compose
        ├── components/         Navbar, AuthForm, ComposeForm, EmailsTable, EmailDetailsModal, RequireAuth
        ├── components/ui/      Button, Input, Textarea, Table, Modal, StatusBadge,
        │                       LoadingSpinner, EmptyState, ErrorMessage, FormField
        ├── context/            AuthContext, ToastContext
        ├── lib/                api client, auth storage, formatting, useEmails hook
        └── types/              User, Email, API response/request types
```

## 6. Prerequisites

- Node.js 20 or newer (developed on Node 22) and npm
- Docker with Docker Compose (for PostgreSQL and Redis)
- Internet access once, to create a free Ethereal account

## 7. Installation

```bash
git clone <your-repo-url> scheduled-email-app
cd scheduled-email-app
npm run install:all          # installs backend and frontend dependencies
```

## 8. Docker setup (PostgreSQL + Redis)

```bash
docker compose up -d         # start both in the background
docker compose ps            # both should be "healthy"
docker compose down          # stop (data is kept in Docker volumes)
docker compose down -v       # stop AND delete all data
```

Defaults: PostgreSQL `postgres/postgres` database `scheduled_email` on port 5432, Redis on 6379. Override with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `REDIS_PORT` (and keep `backend/.env` in sync).

## 9. PostgreSQL setup

Nothing to do manually: the compose file creates the `scheduled_email` database. Tables are created by the migration in section 15.

## 10. Redis setup

Nothing to do manually. Compose starts Redis with `--appendonly yes` (so delayed jobs survive a Redis restart) and `--maxmemory-policy noeviction` (what BullMQ requires).

## 11. Backend setup

```bash
cd backend
cp .env.example .env         # then edit it, see sections 13 and 14
```

Set a real `JWT_SECRET` and the SMTP values (section 14). Then:

```bash
npm run migrate              # create tables
npm run seed                 # optional demo user
npm run dev                  # Terminal 1: API on http://localhost:4000
npm run worker               # Terminal 2: BullMQ worker
```

Production-style run: `npm run build`, then `npm start` and `npm run start:worker`.

## 12. Frontend setup

```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm run dev                  # Terminal 3: http://localhost:3000
```

## 13. Environment variables

Backend (`backend/.env`, template in `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin(s), comma separated |
| `DATABASE_URL` | none (required) | PostgreSQL connection string |
| `REDIS_URL` | none (required) | Redis connection string |
| `JWT_SECRET` | none (required, 16+ chars) | JWT signing key. **Fill in manually** |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` `SMTP_FROM` | none | Ethereal SMTP. **Fill in manually**; required by the worker |
| `WORKER_CONCURRENCY` | `5` | Parallel jobs per worker process |
| `EMAIL_RATE_LIMIT_MAX` / `EMAIL_RATE_LIMIT_DURATION_MS` | `5` / `10000` | Worker sends at most MAX jobs per DURATION |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `60000` / `100` | Global API limit per IP |
| `AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_RATE_LIMIT_MAX` | `900000` / `20` | Login/register limit per IP |
| `SCHEDULE_RATE_LIMIT_MAX` | `60` | Schedule requests per user per `RATE_LIMIT_WINDOW_MS` |
| `RECONCILE_INTERVAL_MS` | `60000` | How often the worker reconciles DB and queue |
| `STALE_PROCESSING_MS` | `120000` | A `processing` row older than this is treated as a crashed send |

Frontend (`frontend/.env.local`): `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api`).

Real credentials are never committed: `.env` and `.env.local` are in `.gitignore`; only `.env.example` files are tracked.

## 14. Ethereal Email setup

Ethereal is a fake SMTP service: it accepts messages and shows them in a web inbox, but delivers nothing. This step **cannot be automated for you**, because the account is created on your machine with your network access. Either:

**Option A (command):**
```bash
cd backend
npm run ethereal:create
```
Copy the printed `SMTP_*` lines into `backend/.env`.

**Option B (website):** open <https://ethereal.email/create>, click "Create Ethereal Account", and copy the host, port (587), username and password into `backend/.env`. Set `SMTP_FROM` to something like `"Scheduled Email App <your-ethereal-username@ethereal.email>"`.

To see sent emails: log in at <https://ethereal.email/login> with that username and password, then open **Messages**. The worker also logs a preview URL for each message.

## 15. Database migration

```bash
cd backend
npm run migrate
```

The runner applies every `migrations/*.sql` file in order inside a transaction and records it in `schema_migrations`, so running it again is safe. From the repo root: `npm run migrate`.

Schema (`migrations/001_init.sql`): `users` (id, email unique, password_hash, created_at, updated_at) and `emails` (id, user_id → users.id, to_email, subject, body, scheduled_at, status, sent_at, error_message, created_at, updated_at), with a `CHECK` on status and indexes on `user_id`, `status`, `scheduled_at` and `(user_id, status, scheduled_at)`. All timestamps are `TIMESTAMPTZ` (stored as UTC); the API returns ISO-8601 UTC strings and the browser converts to local time.

## 16. Demo account

```bash
cd backend && npm run seed
```

Creates `demo@example.com` / `Demo@12345`. **Local development demo account only.** The app does not depend on it; you can also register through `/register`.

## 17. How scheduling works

Scheduling is split into a durable record and a timer:

- **Durable record:** the email row in PostgreSQL (`status = 'scheduled'`, `scheduled_at`).
- **Timer:** a BullMQ **delayed job** in Redis. BullMQ keeps delayed jobs in a Redis sorted set keyed by when they become due; when the time arrives it moves them to the waiting list and a worker takes them. There is no `setTimeout`/`setInterval` for scheduling anywhere in the code (the only interval is the 60 s reconciler).

The job carries only `{ emailId }`. The worker always reloads the row from PostgreSQL, so edits to the row (or its status) are always respected.

## 18. How BullMQ works here

- Queue `email-queue`, job name `send-email`.
- **Deterministic job id** `email-<emailId>`: adding the same job twice is a no-op, which makes enqueueing and reconciliation safe to repeat.
- Default job options: `attempts: 3`, exponential backoff starting at 5 s, completed jobs kept 1 h, failed jobs kept 24 h.
- Worker logic (`src/workers/emailProcessor.ts`):
  1. **Claim** the email with one atomic statement: `UPDATE emails SET status='processing' WHERE id=$1 AND status='scheduled' RETURNING *`. If no row comes back, someone else already handled it and the job exits (`skipped`).
  2. Send via Nodemailer.
  3. Success → `status='sent'`, `sent_at=now()`.
  4. Failure with attempts left → back to `scheduled` with the error noted, and the error is re-thrown so BullMQ retries after the backoff.
  5. Failure on the last attempt → `status='failed'`, `error_message` stored.

## 19. How persistence after restart works

Three independent layers protect a scheduled email:

1. **PostgreSQL** holds every email and its status. Nothing in memory is needed to know what is scheduled.
2. **Redis with AOF** (enabled in `docker-compose.yml`) keeps the delayed jobs. Stopping/restarting the API and worker doesn't touch them, and when a worker starts, BullMQ immediately picks up every job that became due while it was down.
3. **Reconciliation** (`src/services/reconciliationService.ts`) repairs any mismatch between 1 and 2. It runs when the API starts, when the worker starts, and every `RECONCILE_INTERVAL_MS` in the worker:
   - `processing` rows older than `STALE_PROCESSING_MS` (a worker died mid-send) are moved back to `scheduled`.
   - For every `scheduled` row, it asks BullMQ whether job `email-<id>` exists. If missing (for example Redis was wiped), it re-adds it with `delay = max(0, scheduledAt − now)`: the remaining delay is preserved for future emails, and overdue emails run immediately.
   - If a job exists but is already `completed`/`failed` while the row is still `scheduled`, the stale job is removed and a fresh one is added.
   - Existing live jobs are left alone, so no duplicates are created.

If Redis is down at the moment a user schedules an email, the row is still saved (the API returns `201`), the enqueue error is logged, and the reconciler creates the job once Redis is back.

## 20. How rate limiting works

| What | Limit (default) | Scope | Mechanism |
| --- | --- | --- | --- |
| All `/api` requests | 100 per 60 s | per client IP | `express-rate-limit` |
| `POST /auth/login`, `/auth/register` | 20 per 15 min | per client IP | `express-rate-limit` (slows password guessing) |
| `POST /emails/schedule` | 60 per 60 s | per authenticated user | `express-rate-limit` |
| Email sending | 5 sends per 10 s | across all workers | BullMQ worker `limiter` (stored in Redis) |

Behaviour: over-limit API requests get `429` with the standard JSON error (`RATE_LIMITED`) and `RateLimit-*` headers. Over-limit **email jobs are not rejected**: they stay queued and the worker simply starts them later, so a burst of emails is smoothed out instead of failing.

Honest limits of this design: the three API limiters use `express-rate-limit`'s default **in-memory store**, so counters are per API process and reset when it restarts. They are **not** a distributed guarantee; with several API instances you would add a Redis store. The email throughput limit **is** enforced through Redis and therefore applies across all worker processes. Limits are keyed by IP; behind a proxy you would configure Express `trust proxy`.

## 21. How concurrency works

- `WORKER_CONCURRENCY` (default 5) is how many jobs one worker process runs **at the same time**. Node stays single-threaded; this is concurrent I/O (several SMTP sends in flight), not threads.
- The throughput limiter (default 5 per 10 s) caps how many jobs may *start* in a window. Together they bound SMTP load: never more than `WORKER_CONCURRENCY` simultaneous sends per worker, and never more than the limiter allows over time.
- You can run more worker processes; BullMQ hands each job to exactly one of them. If two workers did receive the same job, the atomic claim in step 1 of section 18 lets only one send.
- SMTP timeouts are 10–15 s, so a stuck connection can't hold a concurrency slot indefinitely.

## 22. API endpoints

All responses: success `{ "success": true, "data": ... }`; error `{ "success": false, "error": { "code", "message", "details?" } }`. Stack traces are never returned.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | no | Liveness check |
| POST | `/api/auth/register` | no | `{ email, password }` (password ≥ 8 chars) → `201 { token, user }` |
| POST | `/api/auth/login` | no | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | yes | Current user |
| POST | `/api/emails/schedule` | yes | `{ toEmail, subject, body, scheduledAt }` (ISO-8601 with offset, in the future) → `201 email` |
| GET | `/api/emails/scheduled` | yes | Your `scheduled` + `processing` emails, soonest first |
| GET | `/api/emails/sent` | yes | Your `sent` + `failed` emails, newest first |
| GET | `/api/emails/:id` | yes | One of your emails (`404` if it isn't yours) |

Authenticated routes need `Authorization: Bearer <token>`. The user id always comes from the JWT, never from the request body.

Example:
```bash
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Demo@12345"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).data.token")

curl -X POST localhost:4000/api/emails/schedule -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"toEmail\":\"a@example.com\",\"subject\":\"Hi\",\"body\":\"Hello\",\"scheduledAt\":\"$(node -pe 'new Date(Date.now()+60000).toISOString()')\"}"
```

## 23. Testing

```bash
cd backend
npm test            # 26 tests; no Redis, SMTP or PostgreSQL needed
npm run typecheck
npm run lint
```

The tests run against an in-memory PostgreSQL (pg-mem) using the real migration file, with the queue and Nodemailer mocked. They cover: registration/login, password hashing and no hash in responses, authentication protection, scheduling, rejecting past times and invalid input, listing, per-user authorization (including a spoofed `userId` in the body), status transitions (`scheduled → processing → sent`, retry back to `scheduled`, final `failed`), duplicate-job idempotency (two concurrent jobs → one send), and reconciliation (missing job re-created, no duplicates, overdue emails, failed jobs replaced, errors tolerated).

Frontend: `cd frontend && npm run typecheck && npm run lint && npm run build`.

**Manual test sequence**

1. Start everything (section 28), open <http://localhost:3000>, log in as the demo user.
2. Dashboard shows "No scheduled emails yet." and "No sent emails yet." on the two tabs.
3. Try to log in with a wrong password → error message.
4. Compose: submit empty → field errors; pick a past time → "Scheduled time must be in the future".
5. Compose an email, click **1 min**, **Schedule Email** → success toast, redirected to the dashboard, email under *Scheduled*.
6. Within ~1 minute (and the 10 s auto-refresh) it appears under *Sent Emails* with status `sent`.
7. Open the Ethereal inbox: the message is there.
8. To see `failed`: set a wrong `SMTP_PASSWORD`, restart the worker, schedule an email; after 3 attempts (≈15 s of backoff) it shows `failed` with the error.

## 24. Restart demonstration

Terminal 1 `cd backend && npm run dev`, Terminal 2 `cd backend && npm run worker`, Terminal 3 `cd frontend && npm run dev`.

1. Log in and schedule two emails: one in **1 min**, one in **3 min** (use the quick buttons).
2. Confirm both under *Scheduled Emails*.
3. **Stop** the API and worker with `Ctrl+C` in Terminals 1 and 2 (you can also use `kill -9` to simulate a crash).
4. Wait until the 1-minute email's time has passed. It is *not* sent: nothing is running.
5. **Start** them again (`npm run dev`, `npm run worker`).
6. The worker logs `Email <id> sent to ...` for the overdue email immediately, and the 3-minute email is sent at its original time. Refresh the dashboard to see both in *Sent Emails*.
7. Optional, harder case, **Redis wiped**: schedule an email, run `docker compose exec redis redis-cli flushall`, and within one reconcile interval (≤ 60 s) the worker logs `Reconciliation finished { requeued: 1 }` and the email still sends.

## 25. Rate limiting and concurrency demonstration

With the API and worker running and the demo user seeded:

```bash
cd backend
npm run demo:load -- 20 30      # 20 emails, all due 30 seconds from now
```

All 20 emails are due at the same instant. The script waits and then prints when each was sent:

```
Seconds after the first send, per email:
0.0  0.0  0.0  0.0  0.0  10.0  10.0  10.0  10.0  10.0  20.0 ... 30.0
All 20 scheduled for the same instant, sent over 30.0s.
```

That is the 5-per-10-seconds throughput limit in action. Change `EMAIL_RATE_LIMIT_MAX` / `EMAIL_RATE_LIMIT_DURATION_MS` / `WORKER_CONCURRENCY` in `backend/.env`, restart the worker, and run it again to see the pattern change. To see API rate limiting, send more than 20 wrong logins within 15 minutes and observe `429` responses (restart the API to reset the counters).

## 26. Assumptions

- A single deployment of the API and one or more workers sharing one PostgreSQL and one Redis.
- Emails are plain text. The recipient is a single address.
- Users pick times in their browser's local time zone; the backend stores UTC.
- Ethereal is for development; for real delivery only the `SMTP_*` variables change.
- Scheduled emails cannot be edited or cancelled (not required by the assignment).

## 27. Trade-offs

- **At-least-once delivery.** The atomic claim prevents duplicates from replayed or concurrent jobs, but if a worker dies *after* SMTP accepted the message and *before* the database update, the stale `processing` row is later reset and the email could be sent a second time. Closing that window completely needs SMTP-level idempotency, which plain SMTP doesn't offer.
- **In-memory API rate limiting** is simple but per process (see section 20).
- **JWT in `localStorage`** is simple for an assignment but exposed to XSS; httpOnly cookies would be stronger.
- **Polling every 10 s** instead of WebSockets/SSE keeps the frontend simple.
- **No pagination.** Lists return all of a user's emails, and the reconciler loads all `scheduled` rows. Fine at this scale, would need paging/batching at much larger volumes.
- **No ORM.** Plain SQL and a tiny migration runner keep behaviour obvious; Prisma would add tooling without much benefit here.
- The app processes run on the host (not in containers) to keep development and the restart demo easy.

## 28. Exact commands to run everything

```bash
# one-time setup
git clone <your-repo-url> scheduled-email-app && cd scheduled-email-app
npm run install:all
docker compose up -d
cp backend/.env.example backend/.env           # then edit JWT_SECRET and SMTP_* (section 14)
cp frontend/.env.example frontend/.env.local
npm run migrate
npm run seed                                   # demo@example.com / Demo@12345

# every time (three terminals)
cd backend  && npm run dev                     # Terminal 1: API  :4000
cd backend  && npm run worker                  # Terminal 2: worker
cd frontend && npm run dev                     # Terminal 3: UI   :3000

# stop infrastructure
docker compose down
```

## Features mapped to assignment requirements

| Requirement | Where |
| --- | --- |
| Login, protected dashboard | `AuthForm`, `RequireAuth`, `/api/auth/*`, `authenticate` middleware |
| Compose: recipient, subject, body, future date/time | `ComposeForm`, `scheduleEmailSchema` |
| View scheduled / sent emails, statuses | Dashboard tabs, `EmailsTable`, `StatusBadge`, `/api/emails/scheduled|sent` |
| Loading, empty, error states, toasts | `LoadingSpinner`, `EmptyState`, `ErrorMessage`, `ToastContext` |
| Express, PostgreSQL, Redis, BullMQ, worker | `backend/src`, `docker-compose.yml`, `workers/` |
| Ethereal via Nodemailer | `services/mailService.ts` |
| Scheduler (not timers) | BullMQ delayed jobs, `queues/emailQueue.ts` |
| Persistence after restart | PostgreSQL + Redis AOF + `reconciliationService.ts` |
| Retries | BullMQ attempts/backoff, `emailProcessor.ts` |
| Rate limiting | `middleware/rateLimiters.ts`, worker `limiter` |
| Concurrency | `WORKER_CONCURRENCY` in `emailWorker.ts` |
| Duplicate-send protection | Atomic claim + deterministic job id |

## Submission checklist

**Backend:** [x] Express [x] PostgreSQL [x] Redis [x] BullMQ [x] Scheduler [x] Persistent scheduled emails [x] Worker [x] Retry handling [x] Rate limiting [x] Concurrency [x] Restart recovery [x] Ethereal/Nodemailer [x] Authentication [x] Validation

**Frontend:** [x] Login [x] Dashboard [x] Compose email [x] Scheduled table [x] Sent table [x] Status [x] Loading state [x] Empty state [x] Error handling [x] Reusable components [x] TypeScript

**Submission:** [x] README [x] Architecture explanation [x] Run instructions [x] Env setup [x] Ethereal setup [x] Restart demo instructions [x] Rate limiting/concurrency explanation [x] Assumptions/trade-offs [x] Demo video instructions (below)

## Demo video instructions

Record about 3 to 5 minutes (any screen recorder) showing, in order:

1. The three terminals running (API, worker, frontend) and `docker compose ps`.
2. Logging in, then the empty Scheduled and Sent tabs.
3. Scheduling two emails (1 min and 3 min), and the validation error for a past time.
4. Stopping the API and worker (`Ctrl+C`), waiting until the first time has passed, starting them again, and the overdue email being sent right away; the second sending at its time.
5. The Ethereal inbox with the received messages.
6. Bonus: `npm run demo:load -- 20 30` and the 5-per-10-seconds pattern in the output and worker logs.
