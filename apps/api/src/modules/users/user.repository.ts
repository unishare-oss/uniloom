import { prisma } from '@/db/prisma.js';

/** Sets consentGivenAt only if it is still empty. */
export function setConsentIfMissing(userId: string) {
  return prisma.user.updateMany({
    where: { id: userId, consentGivenAt: null },
    data: { consentGivenAt: new Date() },
  });
}

export function findConsent(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { consentGivenAt: true },
  });
}
