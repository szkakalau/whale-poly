import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

const rawDatabaseUrl = process.env.DATABASE_URL ?? '';
const shouldRequireSsl = rawDatabaseUrl.includes('render.com') && !rawDatabaseUrl.includes('sslmode=');
const databaseUrl = shouldRequireSsl
  ? `${rawDatabaseUrl}${rawDatabaseUrl.includes('?') ? '&' : '?'}sslmode=require`
  : rawDatabaseUrl;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
