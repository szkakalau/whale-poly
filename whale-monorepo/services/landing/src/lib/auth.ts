import { headers } from 'next/headers';
import { prisma } from './prisma';

export type AuthUser = {
  id: string;
  email: string;
  telegramId: string | null;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const hdrs = await headers();
  const userId = hdrs.get('x-user-id');
  if (!userId) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, telegramId: true },
  });
  if (!user) {
    return null;
  }
  return user;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }
  return user;
}
