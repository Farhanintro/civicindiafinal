import { PrismaClient } from '@prisma/client'

// Prisma client singleton.
// Production (Supabase PostgreSQL): connect via the transaction pooler URL
// (POSTGRES_URL / DATABASE_URL with ?pgbouncer=true&connection_limit=1 —
// serverless friendly). POSTGRES_URL wins when both are set: some hosts
// (e.g. managed sandboxes) pre-inject DATABASE_URL as a real env var, which
// would silently override the .env value — the dedicated var cannot collide.
function resolveRuntimeUrl(): string | undefined {
  const pg = process.env.POSTGRES_URL?.trim()
  if (pg) return pg
  const fallback = process.env.DATABASE_URL?.trim()
  // Guard: the schema is postgresql — a stray file: URL (sandbox default)
  // must never reach the client.
  if (fallback && !fallback.startsWith('file:')) return fallback
  return undefined
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveRuntimeUrl(),
    // query logging is a dev-only aid; keep production logs quiet (errors only)
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
