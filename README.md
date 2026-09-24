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
| Database | **Prisma ORM + SQLite (dev)** | Zero-infra; swap `provider` to `postgresql` for Supabase in production |
| AI | **Multimodal vision LLM** (z-ai SDK default, **Google Gemini adapter included** — activate with `GEMINI_API_KEY`) | Provider-swappable `AIService` |
| Geocoding | **OSM Nominatim** (server-side, cached) | Free, graceful fallback to coordinates |
| Auth | Lightweight demo cookie session | Structured for NextAuth/Supabase Auth later |

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

**Demo users** (name-based demo login — see *Limitations*):
- Citizen: `Aarav Sharma` (has report history + notifications)
- Authority/Admin: `Neha Kulkarni`

## Quick start

```bash
# 1. Install dependencies
bun install            # or npm install

# 2. Configure environment
cp .env.example .env   # defaults work out of the box for local dev

# 3. Create the database schema
bun run db:push

# 4. Seed categories, departments, demo users and demo incidents
bun run seed           # add --hard-reset for a full wipe & reseed

# 5. Run
bun run dev            # http://localhost:3000
```

### Run on your local machine — 100% REAL data (no demo incidents)

1. Install **Bun** (recommended — it runs the TypeScript seed with path aliases out of the box): <https://bun.sh> · or `npm install -g bun`
2. `bun install`
3. `cp .env.example .env` — then **add your free Gemini key** for real AI photo analysis (get one at <https://aistudio.google.com/apikey>): `GEMINI_API_KEY=AIza...`
4. `bun run db:push` → `bun run seed:base` *(seeds only the 10 categories + 8 departments — no demo incidents, no demo users)*
5. `bun run dev:local` (Windows-friendly; use `bun run dev` on macOS/Linux/WSL)
6. Open <http://localhost:3000>, log in with **any name** as Citizen or Authority — users are created on first login.

Everything you report now is real: your photos, real GPS, real Gemini analysis, real incidents on the map. To wipe real data later: `bun run seed --hard-reset`. To add the SIH demo dataset back: `bun run seed`.

> **Note on AI:** without `GEMINI_API_KEY`, photo analysis falls back to a keyword heuristic labelled *"AI analysis temporarily unavailable — saved for manual review"* — the report is never lost. The 9 bundled sample photos always use precomputed results (zero quota). Every analysis is called **once** and cached in `ai_analyses` forever.

> **Windows:** use `bun run dev:local` (the default `dev` script pipes logs through `tee`, which needs macOS/Linux/WSL/Git Bash). `bun`, `prisma` and all other scripts are fully cross-platform.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | SQLite path (dev) or PostgreSQL URL (production) |
| `GEMINI_API_KEY` | no | Activates the **Google Gemini** adapter; empty = built-in z-ai vision provider |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.0-flash` |
| `DUPLICATE_RADIUS_METERS` | no | Duplicate-detection radius (default 150) |
| `DUPLICATE_TIME_WINDOW_DAYS` | no | Duplicate-detection window (default 60) |

`.env` is git-ignored; `.env.example` contains placeholders only.

## The exact demo scenario (verified end-to-end)

1. Open CivicLens → **Continue as Citizen** (`Aarav Sharma`)
2. **Report an issue** → pick/take a photo (or a sample photo)
3. GPS captured (or search/pick a location manually) → optional description
4. **AI analysis** with staged progress → review screen (category, confidence, severity, hazards, department, reasoning)
5. **Submit** → duplicate check → *link to existing incident* or *create new*
6. Success screen with incident ID, explainable priority and routing
7. **Sign out → Continue as Authority** (`Neha Kulkarni`) → command center
8. Open the incident → **Verify → Assign (Roads/PWD + team) → Start work**
9. **Upload after photo** (resolution evidence) → **Resolve**
10. Back as the citizen: dashboard shows *Resolved*, full timeline, **before/after** evidence, notification *"INC-xxxx resolved"*.

## Testing

- `bun run lint` — ESLint (Next.js + TypeScript rules) — **must pass clean**.
- Manual golden-path testing of the full scenario above (browser-verified, including API-level negative cases: invalid status transitions → 400, resolve without evidence → 400, admin routes → 401/403 for citizens, unauthenticated analyze → 401).
- Priority engine, department routing, duplicate detection and AI JSON validation are pure typed modules (`src/lib/services/`) designed for unit testing.

## Deployment

**Vercel + Supabase (free-tier friendly):**
1. Create a Supabase project → copy the PostgreSQL connection string.
2. In `prisma/schema.prisma` change `provider = "sqlite"` → `"postgresql"`, set `DATABASE_URL`, run `bun run db:push` and `bun run seed`.
3. Replace the local `ImageStorage` adapter (`src/lib/services/storage-service.ts`) with a Supabase Storage/S3 adapter (the interface is already isolated: `validateImage` + `storeImage`).
4. Push to GitHub → import into Vercel → set env vars → deploy.

> Note: the current local adapter writes uploads to `public/uploads`, which suits self-hosted/VPS deployments; serverless filesystems need the storage adapter swap above.

## Limitations (honest scope statement)

- **Demo authentication** is name-based (structured for NextAuth/Supabase Auth; roles CITIZEN/ADMIN already enforced on every API route).
- **Category-based routing**, not jurisdiction-aware routing (the state→district→city→ward model is in the data model for the future).
- Duplicate detection is distance/category/time-based; image-embedding similarity is future work.
- Priority is an **AI-assisted assessment**, not an official government prioritization algorithm (labelled as such in the UI).
- Reverse geocoding depends on Nominatim availability; the app degrades to coordinates + manual city selection.
- Analytics are aggregated on request (fine for demo scale; materialized views/PostGIS at production scale).

## Future roadmap

Government/municipal API integration · advanced geospatial clustering (PostGIS) · image embeddings & perceptual-hash dedup · offline reporting queue · SMS/WhatsApp notifications · multilingual reporting (Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi — UI strings already centralized) · voice reporting · on-device CV models · IoT sensor ingestion · predictive maintenance · ward-level analytics · jurisdiction-aware routing · public transparency dashboard · SLA monitoring · fraud/spam detection · citizen trust signals.

## Security & privacy

- API keys live only in server env vars; the frontend never receives them. `.env` is git-ignored; a repo-wide secret scan (API-key patterns) is part of the release checklist.
- All uploads validated (type, size); all API input validated (Zod / manual guards); admin routes require the ADMIN role; citizens can only submit/track their own reports.
- Citizen identities are **never** exposed on public incident views (reporter names appear only inside the authority workflow); location is used solely to place reports on the map and route them.

---

*Built for the Smart India Hackathon. Demo data is fictional and labelled as such.* **CivicLens** — every report counts, every incident is tracked.
