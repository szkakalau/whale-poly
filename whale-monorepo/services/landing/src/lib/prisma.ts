import { PrismaClient } from '@prisma/client';

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
