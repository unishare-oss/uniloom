import { prisma } from '@/db/prisma.js';

export const findConsent = (userId: string) => {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { unicorpTermsVersion: true, unicorpTermsAcceptedAt: true },
  });
};
