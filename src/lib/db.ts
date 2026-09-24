import { PrismaClient } from '@prisma/client'

// Prisma client singleton.
// Production (Supabase PostgreSQL): connect via the transaction pooler URL
// (DATABASE_URL with ?pgbouncer=true&connection_limit=1 — serverless friendly).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // query logging is a dev-only aid; keep production logs quiet (errors only)
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
