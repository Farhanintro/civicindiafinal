// CivicLens — SQLite → Supabase PostgreSQL one-time data migration.
// Usage: bun run scripts/migrate-to-supabase.ts
//
// Reads every row from db/custom.db (the local/offline database) and inserts
// it into the live Supabase PostgreSQL database via Prisma, preserving:
//   • primary/foreign keys (cuid)  • publicIds (INC-1001, REP-0001…)
//   • bcrypt password hashes       • createdAt / updatedAt timestamps
//
// Idempotent: wipes the target tables first (child → parent order), so it can
// safely be re-run. SQLite is opened READ-ONLY and never modified.

import { Database } from "bun:sqlite"
import { PrismaClient } from "@prisma/client"

// POSTGRES_URL beats a stray globally-injected DATABASE_URL (file:) — see src/lib/db.ts
function resolveUrl(): string {
  const pg = process.env.POSTGRES_URL?.trim()
  if (pg) return pg
  const fallback = process.env.DATABASE_URL?.trim() ?? ""
  if (fallback && !fallback.startsWith("file:")) return fallback
  throw new Error("No postgres URL found — set POSTGRES_URL in .env")
}

const SQLITE_PATH = "db/custom.db" // relative to project root (cwd)

// table = SQLite table name · model = Prisma delegate · dates/bools need type conversion
const TABLES: Array<{
  table: string
  model: string
  dates: string[]
  bools: string[]
}> = [
  { table: "User", model: "user", dates: ["createdAt", "updatedAt"], bools: ["isDemo"] },
  { table: "Category", model: "category", dates: [], bools: ["active"] },
  { table: "Department", model: "department", dates: [], bools: [] },
  {
    table: "Incident",
    model: "incident",
    dates: ["resolvedAt", "createdAt", "updatedAt"],
    bools: ["isDemo"],
  },
  {
    table: "Report",
    model: "report",
    dates: ["captureTimestamp", "submissionTimestamp", "createdAt"],
    bools: ["locationChanged", "isDemo"],
  },
  { table: "AiAnalysis", model: "aiAnalysis", dates: ["createdAt"], bools: ["isCivicIssue"] },
  { table: "IncidentReport", model: "incidentReport", dates: ["createdAt"], bools: [] },
  { table: "StatusHistory", model: "statusHistory", dates: ["createdAt"], bools: [] },
  { table: "Assignment", model: "assignment", dates: ["createdAt"], bools: ["active"] },
  { table: "Notification", model: "notification", dates: ["createdAt"], bools: ["isRead"] },
  { table: "ResolutionEvidence", model: "resolutionEvidence", dates: ["createdAt"], bools: [] },
]

// child-first deletion order (reverse of insert order)
const DELETE_ORDER = [
  "resolutionEvidence",
  "notification",
  "assignment",
  "statusHistory",
  "incidentReport",
  "aiAnalysis",
  "report",
  "incident",
  "user",
  "category",
  "department",
] as const

function convert(row: Record<string, unknown>, dates: string[], bools: string[]) {
  const out: Record<string, unknown> = { ...row }
  for (const key of dates) {
    const v = out[key]
    out[key] = v == null ? null : new Date(v as string | number)
  }
  for (const key of bools) {
    const v = out[key]
    out[key] = v == null ? false : Boolean(v)
  }
  return out
}

async function main() {
  console.log("═ CivicLens SQLite → Supabase migration ═\n")

  const sqlite = new Database(SQLITE_PATH, { readonly: true })
  const prisma = new PrismaClient({ datasourceUrl: resolveUrl() })

  try {
    // 1. wipe target tables (idempotent re-runs)
    console.log("→ Clearing Supabase tables (child → parent)…")
    for (const model of DELETE_ORDER) {
      // @ts-expect-error dynamic delegate over 11 known models
      await prisma[model].deleteMany()
    }

    // 2. copy every table in FK-safe order
    let total = 0
    for (const { table, model, dates, bools } of TABLES) {
      const rows = sqlite.query(`SELECT * FROM "${table}"`).all() as Array<
        Record<string, unknown>
      >
      if (rows.length === 0) {
        console.log(`  ${table.padEnd(20)} 0 rows — skipped`)
        continue
      }
      const data = rows.map((r) => convert(r, dates, bools))
      // @ts-expect-error dynamic delegate over 11 known models
      await prisma[model].createMany({ data })
      total += data.length
      console.log(`  ${table.padEnd(20)} ${String(data.length).padStart(3)} rows ✓`)
    }

    // 3. verify: compare counts source vs target
    console.log("\n→ Verifying row counts…")
    let ok = true
    for (const { table, model } of TABLES) {
      const src = (sqlite.query(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number }).c
      // @ts-expect-error dynamic delegate over 11 known models
      const dst: number = await prisma[model].count()
      const match = src === dst ? "✓" : "✗ MISMATCH"
      if (src !== dst) ok = false
      console.log(`  ${table.padEnd(20)} sqlite=${src}  supabase=${dst}  ${match}`)
    }

    if (!ok) throw new Error("Row count mismatch — see table above")
    console.log(`\n✔ Migration complete — ${total} rows now live on Supabase PostgreSQL.`)
  } finally {
    sqlite.close()
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error("\n✖ Migration failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
