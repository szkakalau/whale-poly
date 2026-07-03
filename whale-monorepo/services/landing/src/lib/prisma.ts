import { PrismaClient } from '@prisma/client';

// Cache PrismaClient on globalThis in dev to survive Next.js hot reloads.
// In production (serverless), each cold start creates a fresh client — this
// is intentional since instances are short-lived. (CR-A1)
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

const rawDatabaseUrl = (process.env.DATABASE_URL ?? '').trim();
const shouldRequireSsl = rawDatabaseUrl.includes('render.com') && !rawDatabaseUrl.includes('sslmode=');
const databaseUrl = shouldRequireSsl
  ? `${rawDatabaseUrl}${rawDatabaseUrl.includes('?') ? '&' : '?'}sslmode=require`
  : rawDatabaseUrl;

const prismaInstance =
  rawDatabaseUrl.length > 0
    ? globalForPrisma.prisma ??
      new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
        log: ['error', 'warn'],
        // Explicit connection pool config (CR-I1).
        // Prisma uses its own pool (not pg-pool); defaults are reasonable
        // (connection_limit derived from num_cpus).  Set pool_timeout to
        // avoid infinite wait when all connections are in use.
        transactionOptions: {
          maxWait: 10_000, // fail fast instead of hanging under load
          timeout: 30_000, // kill long-running transactions
        },
      })
    : new Proxy({} as PrismaClient, {
        get() {
          throw new Error('DATABASE_URL is required to use Prisma.');
        },
      });

export const prisma = prismaInstance;

if (process.env.NODE_ENV !== 'production' && rawDatabaseUrl.length > 0) {
  globalForPrisma.prisma = prisma;
}
