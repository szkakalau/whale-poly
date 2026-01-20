import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['warn', 'error']
});

export async function connectPrisma() {
  try {
    await prisma.$connect();
    console.log('Prisma connected');
  } catch (err) {
    console.error('Failed to connect Prisma', err);
  }
}