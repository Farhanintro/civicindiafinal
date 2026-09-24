# CivicLens

**AI-Powered Geo-Intelligent Civic Issue Reporting & Infrastructure Intelligence Platform**

> *See a problem. Report it. Track the action.*
>
> AI-powered civic intelligence that transforms scattered, geo-tagged citizen evidence into actionable infrastructure incidents — anywhere in India.

CivicLens is not "an app that detects potholes." It is an **AI-powered civic intelligence layer** that converts citizen photos + GPS into classified, severity-assessed, hazard-aware, prioritized and department-routed infrastructure **incidents** — and clusters duplicate citizen reports about the *same physical problem* into one trackable ticket.

**One physical problem · many citizen reports · one tracked incident.**

---

## The problem

- Citizens see civic issues (potholes, garbage, leaks, open manholes…) but reporting is fragmented: phone calls, tweets, complaints vanish into silos.
- Municipalities receive **unstructured, duplicated, unprioritized** complaints with no evidence, no location confidence and no accountability loop.
- Ten citizens reporting the same pothole create **ten tickets**, wasting field-team time and destroying citizen trust.

## The solution — end-to-end civic intelligence

```
CITIZEN EVIDENCE → AI ANALYSIS → GEOLOCATION → INCIDENT INTELLIGENCE
→ PRIORITY → ROUTING → AUTHORITY ACTION → RESOLUTION → FEEDBACK
```

1. A citizen photographs the problem; CivicLens captures GPS (with manual map/search fallback).
2. The photo is compressed client-side and analyzed **once** by a multimodal AI (category, confidence, severity, hazards, recommended department, reasoning — structured JSON).
3. Nearby active incidents of the same category are checked — **duplicate detection**. The citizen chooses to *link* their report to the existing incident or create a new one.
4. An **explainable priority score** (P1–P4) is computed from severity, citizen confirmations, hazard signals and category risk — every reason is shown to citizens and authorities.
5. The incident is routed to the responsible department and appears on the map (priority-coloured markers, clustering).
6. Authorities verify → assign → work → resolve with **photo evidence**; every transition is recorded in a full status history.
7. Citizens receive in-app notifications and see the entire lifecycle, including **before/after evidence**.

## Core differentiator — incident clustering

If 10 citizens report the same pothole, CivicLens creates **one incident** linked to 10 reports. Each confirmation *raises* the explainable priority. Duplicate detection uses geographic distance + category similarity + active status + time window (configurable, env-tunable) — architected so image embeddings / perceptual hashing / PostGIS clustering can be added without changing callers.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + TypeScript** | One deployable, typed full-stack |
| UI | **Tailwind CSS 4 + shadcn/ui + Lucide** | Professional, accessible, responsive |
| State | **Zustand** | Lightweight client state |
| Maps | **Leaflet + OpenStreetMap** | Free, no API key, custom clustering |
| Charts | **Recharts** | Lightweight analytics |
| Database | **Prisma ORM + Supabase PostgreSQL** (production) / SQLite (offline dev) | Real Postgres in the cloud; zero-infra local dev |
| File storage | **Supabase Storage** (public bucket) | Photos live with your database; local-disk fallback in dev |
| AI | **Multimodal vision LLM** (z-ai SDK default, **Google Gemini adapter included** — activate with `GEMINI_API_KEY`) | Provider-swappable `AIService` |
| Auth | **NextAuth.js v4** (credentials, bcrypt, httpOnly JWT) | Proper email+password accounts; free & self-hosted |
| Geocoding | **OSM Nominatim** (server-side, cached) | Free, graceful fallback to coordinates |
No FastAPI, no MongoDB, no Firebase, no microservices — a deliberately simple, free-first architecture.

## Architecture

```
src/
  app/
    page.tsx                 # the single user-facing route — SPA shell
    api/                     # server routes (all AI/quota logic is server-side)
      auth/{login,logout,me} # demo session (httpOnly cookie)
      config/                # configurable categories, departments, samples
      reports/analyze        # ONE multimodal AI call per report (idempotent)
      reports/submit         # duplicate check → link or create incident
      reports/mine           # citizen's reports
      incidents/             # list/filter/search + detail
      incidents/[id]/actions # admin workflow (validated transitions)
      incidents/[id]/evidence# resolution evidence upload
      notifications/         # in-app notifications
      analytics/             # real DB aggregates
      geocode/{reverse,search}
      seed/                  # admin-only demo reseed
  components/civiclens/      # UI (landing, wizard, explore, citizen, admin)
  lib/
    civiclens/               # types, constants (categories/departments config), geo utils, api client
    services/                # business logic — swappable modules:
      ai-service.ts          #   AIService: Gemini | z-ai vision | precomputed demo | fallback
      incident-service.ts    #   IncidentService: create/link, priority recompute, workflow
      duplicate-service.ts   #   DuplicateDetectionService
      priority-service.ts    #   explainable P1–P4 engine
      geocoding-service.ts   #   GeocodingService (cached Nominatim)
      notification-service.ts#   NotificationService
      storage-service.ts     #   ImageStorage (local adapter; swap for Supabase Storage/S3)
      seed-service.ts        #   demo data seeding
      logger.ts              #   lightweight observability (no PII/keys)
  prisma/schema.prisma       # data model
scripts/seed.ts              # bun run seed
public/samples/              # bundled demo photos + precomputed analyses
```

### Data model — REPORT vs INCIDENT

A **REPORT** is one citizen submission. An **INCIDENT** is the physical problem. Tables: `users`, `categories` (configurable), `departments`, `reports`, `incidents`, `incident_reports` (link log `CREATED|LINKED`), `ai_analyses` (one stored analysis per report), `status_history`, `assignments`, `notifications`, `resolution_evidence`.

## AI architecture & free-quota discipline

- **One AI call per report.** The analysis is persisted in `ai_analyses` and returned from storage on every subsequent request — page refreshes, admins opening the incident, map views and analytics **never** re-call the model.
- **Idempotency key** per report: double-clicks, refreshes and network retries return the stored result (`409` while in-flight, stale rows reclaimed after 3 min).
- **Client-side compression** (≤1280 px, JPEG q0.82) before upload; server validates type/size; sha-256 hash stored for future anti-spam.
- **Structured JSON contract** validated with Zod; unknown categories/departments coerced; the model is instructed to never invent facts and to return `is_civic_issue: false` for unclear images.
- **Graceful degradation:** AI failure → keyword-heuristic fallback labelled *"AI analysis temporarily unavailable — saved for manual review"*; the report is never lost.
- **Demo resilience:** the 9 bundled sample photos use **precomputed analyses** (clearly labelled `DEMO PRECOMPUTED`), so the SIH demo works even with zero quota or no internet.
- **Keys are server-side only.** The browser never sees an API key.

## Demo mode

27 seeded incidents + 51 reports across **Alwar, Jaipur, Delhi, Mumbai, Bengaluru, Lucknow, Pune** — potholes, garbage, water leaks, streetlights, sewage, open manholes, dumping, obstructions — with different priorities, statuses, clustered reports, resolved incidents with before/after evidence. Every seeded record is visibly badged **DEMO DATA** and is never presented as real government data.

**Demo accounts** (sign in with email + password):
- Authority/Admin: `admin@civiclens.in` — password from `ADMIN_PASSWORD` env, default `CivicLens@Admin2025` (**change it before real use**)
- Demo citizen (pre-built report history): `aarav@civiclens.in` / `Aarav@12345`

### Authentication (production-grade, always free)

- **Citizens** self-register: *Create Account* (name + email + password) → auto signed in. Passwords are hashed with **bcrypt (cost 12)** — plain passwords are never stored.
- **Authority/Admin** accounts are **provisioned by the seed** (`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` env vars) and can **never be self-registered**.
- Sessions are **signed httpOnly JWT cookies** (NextAuth.js v4) with built-in CSRF protection — nothing session-related is readable from JavaScript.
- **Brute-force protection:** sign-in is rate-limited (10 attempts / 15 min per IP *and* per email); sign-up is rate-limited (5 / 15 min per IP).
- All admin APIs enforce the ADMIN role (403 for citizens); citizens can only access their own reports.
- Sign-up validates email format and password strength (min 8 chars, 1 letter + 1 number) with Zod.
- Everything is self-hosted — **no paid auth service, no external dependency, works offline on localhost.**

## Go live — Supabase + Vercel (production, free tier)

Everything (data **and** photos) lives in your Supabase project. ~10 minutes.

### Step 1 — Create the Supabase project (free)
1. Sign up at <https://supabase.com> → **New project** (pick the **Mumbai** region for India latency) — save the database password.
2. **Storage → New bucket** → name `civiclens-uploads` → toggle **Public bucket** ✅.
3. **Project Settings → API** → copy the **Project URL** and the **service_role** key.
4. **Project Settings → Database → Connection string → URI** → copy both pooler URLs (transaction `:6543` and session `:5432`).

### Step 2 — Configure `.env` locally
```bash
cp .env.example .env
```
Fill in (URL-encode special characters in the password — `%40` for `@` …):
```bash
DATABASE_URL=postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_DATABASE_URL=postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # server-side only — never exposed to the browser
SUPABASE_STORAGE_BUCKET=civiclens-uploads
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000      # your final URL later
ADMIN_PASSWORD=<your strong admin password>
GEMINI_API_KEY=<free key from aistudio.google.com/apikey>
```

### Step 3 — Create tables + seed
```bash
bun run db:push        # creates all 11 tables in Supabase Postgres (uses DIRECT_DATABASE_URL)
bun run seed:base      # categories + departments + authority account (no demo data)
# or the full SIH demo dataset:  bun run seed
```

> **Moving an existing SQLite install to Supabase?** After `db:push`, run
> `bun run migrate:supabase` — copies every row (users, incidents, reports,
> AI analyses, notifications…) from `db/custom.db` into Supabase, preserving
> IDs, password hashes and timestamps. Idempotent; source file untouched.

### Step 4 — Run locally against Supabase
```bash
bun run dev            # http://localhost:3000 — already 100% on your live Supabase DB
```
Photos now upload to `https://YOUR_REF.supabase.co/storage/v1/object/public/civiclens-uploads/...`.

### Step 5 — Deploy to Vercel (free)
1. Push the project to GitHub.
2. <https://vercel.com> → **Add New → Project** → import the repo (framework auto-detected).
3. **Environment Variables** — add the same values as your `.env` (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `NEXTAUTH_SECRET`, `ADMIN_*`, `GEMINI_API_KEY`) and set **`NEXTAUTH_URL=https://your-app.vercel.app`** (your deployment URL).
4. **Deploy** — Vercel automatically runs the `vercel-build` script (`prisma generate && next build`).
5. Open your live URL — sign up as a citizen, or sign in as Authority with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

> **Why two database URLs?** Serverless functions (Vercel) need PgBouncer-compatible pooling — `DATABASE_URL` (transaction pooler, `?pgbouncer=true`) is used by the running app. Schema tools (`db push`, migrations) use `DIRECT_DATABASE_URL` (session pooler). Same project, two doors.

### Offline / demo mode (no internet needed)

```bash
# .env:  DATABASE_URL=file:../db/custom.db   (leave Supabase vars empty)
bun run db:push:local && bun run seed && bun run dev
```
Uses `prisma/schema.sqlite.prisma` and stores photos in `public/uploads` — identical app behavior, zero external services.

## Quick start (offline SQLite)

```bash
# 1. Install dependencies
bun install            # or npm install

# 2. Configure environment
cp .env.example .env   # offline defaults work out of the box

# 3. Create the local database schema
bun run db:push:local

# 4. Seed categories, departments, demo users and demo incidents
bun run seed           # add --hard-reset for a full wipe & reseed

# 5. Run
bun run dev            # http://localhost:3000
```

### Run on your local machine — 100% REAL data (Supabase)

Follow the **Go live** guide above (Steps 1–4): your local dev server then runs entirely on your real Supabase database and storage. Only want categories + departments (no demo incidents)? Use `bun run seed:base`.

Offline alternative (no Supabase): `bun run db:push:local` → `bun run seed:base` → `bun run dev:local`.

Everything you report now is real: your photos, real GPS, real Gemini analysis, real incidents on the map. To wipe real data later: `bun run seed --hard-reset`. To add the SIH demo dataset back: `bun run seed`.

> **Note on AI:** without `GEMINI_API_KEY`, photo analysis falls back to a keyword heuristic labelled *"AI analysis temporarily unavailable — saved for manual review"* — the report is never lost. The 9 bundled sample photos always use precomputed results (zero quota). Every analysis is called **once** and cached in `ai_analyses` forever.

> **Windows:** use `bun run dev:local` (the default `dev` script pipes logs through `tee`, which needs macOS/Linux/WSL/Git Bash). `bun`, `prisma` and all other scripts are fully cross-platform.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Supabase **transaction pooler** (`:6543` + `?pgbouncer=true`) in production; `file:../db/custom.db` for offline dev |
| `POSTGRES_URL` | no | Same value as `DATABASE_URL` — takes precedence at runtime; set it if your host pre-injects a `DATABASE_URL` you can't change |
| `DIRECT_DATABASE_URL` | production | Supabase **session pooler** (`:5432`) — used by `db push` / migrations |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | production | Supabase Storage uploads (server-side only) |
| `SUPABASE_STORAGE_BUCKET` | no | Uploads bucket (default `civiclens-uploads`) |
| `NEXTAUTH_SECRET` | yes | Session signing secret — generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | no | App URL (defaults to `http://localhost:3000` in dev) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | no | Authority account provisioned by the seed (defaults: `admin@civiclens.in` / `CivicLens@Admin2025` / `Neha Kulkarni`) |
| `GEMINI_API_KEY` | no | Activates the **Google Gemini** adapter; empty = built-in z-ai vision provider |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.0-flash` |
| `DUPLICATE_RADIUS_METERS` | no | Duplicate-detection radius (default 150) |
| `DUPLICATE_TIME_WINDOW_DAYS` | no | Duplicate-detection window (default 60) |

`.env` is git-ignored; `.env.example` contains placeholders only.

## The exact demo scenario (verified end-to-end)

1. Open CivicLens → **Sign in** as Citizen (`aarav@civiclens.in` / `Aarav@12345`)
2. **Report an issue** → pick/take a photo (or a sample photo)
3. GPS captured (or search/pick a location manually) → optional description
4. **AI analysis** with staged progress → review screen (category, confidence, severity, hazards, department, reasoning)
5. **Submit** → duplicate check → *link to existing incident* or *create new*
6. Success screen with incident ID, explainable priority and routing
7. **Sign out → Sign in as Authority** (`admin@civiclens.in`) → command center
8. Open the incident → **Verify → Assign (Roads/PWD + team) → Start work**
9. **Upload after photo** (resolution evidence) → **Resolve**
10. Back as the citizen: dashboard shows *Resolved*, full timeline, **before/after** evidence, notification *"INC-xxxx resolved"*.

## Testing

- `bun run lint` — ESLint (Next.js + TypeScript rules) — **must pass clean**.
- Manual golden-path testing of the full scenario above (browser-verified, including API-level negative cases: invalid status transitions → 400, resolve without evidence → 400, admin routes → 401/403 for citizens, unauthenticated analyze → 401).
- Priority engine, department routing, duplicate detection and AI JSON validation are pure typed modules (`src/lib/services/`) designed for unit testing.

## Deployment

**Already configured for Vercel + Supabase** — see the *Go live* section for the full walkthrough. Summary of what is production-wired:

- `prisma/schema.prisma` → **postgresql** with `directUrl` (pooler-safe migrations); SQLite twin at `prisma/schema.sqlite.prisma` for offline dev.
- `src/lib/services/storage-service.ts` → **Supabase Storage adapter** (activates automatically when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set); local-disk fallback otherwise.
- `vercel-build` script → `prisma generate && next build` (runs automatically on Vercel).
- `next.config.ts` → allows Supabase Storage image URLs.
- Self-hosting instead of Vercel? `bun run build && bun start` (standalone output) works on any VPS.

## Limitations (honest scope statement)

- **Credentials auth** (email + password). OAuth providers (Google) and phone OTP can be added via NextAuth later; admin accounts have no self-service password reset yet (re-seed or update the DB).
- Rate limiting is in-memory (per server instance) — fine for single-instance/VPS deployments; move to Redis for multi-instance.
- **Category-based routing**, not jurisdiction-aware routing (the state→district→city→ward model is in the data model for the future).
- Duplicate detection is distance/category/time-based; image-embedding similarity is future work.
- Priority is an **AI-assisted assessment**, not an official government prioritization algorithm (labelled as such in the UI).
- Reverse geocoding depends on Nominatim availability; the app degrades to coordinates + manual city selection.
- Analytics are aggregated on request (fine for demo scale; materialized views/PostGIS at production scale).

## Future roadmap

Government/municipal API integration · advanced geospatial clustering (PostGIS) · image embeddings & perceptual-hash dedup · offline reporting queue · SMS/WhatsApp notifications · multilingual reporting (Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi — UI strings already centralized) · voice reporting · on-device CV models · IoT sensor ingestion · predictive maintenance · ward-level analytics · jurisdiction-aware routing · public transparency dashboard · SLA monitoring · fraud/spam detection · citizen trust signals.

## Security & privacy

- API keys live only in server env vars; the frontend never receives them. `.env` is git-ignored; a repo-wide secret scan (API-key patterns) is part of the release checklist.
- Passwords hashed with **bcrypt (cost 12)**; sessions are signed **httpOnly JWT cookies** with CSRF protection (NextAuth.js v4); sign-in/sign-up rate-limited per IP and per email.
- All uploads validated (type, size); all API input validated (Zod / manual guards); admin routes require the ADMIN role; citizens can only submit/track their own reports.
- Citizen identities are **never** exposed on public incident views (reporter names appear only inside the authority workflow); location is used solely to place reports on the map and route them.

---

*Built for the Smart India Hackathon. Demo data is fictional and labelled as such.* **CivicLens** — every report counts, every incident is tracked.
