import { UNIAUTH_PROVIDER_ID } from '@/auth/auth.js';
import { prisma } from '@/db/prisma.js';

/** The Uniloom user behind a uniAuth sub (through the account row, never by email). */
export const findUserBySub = async (sub: string) => {
  const account = await prisma.account.findUnique({
    where: {
      providerId_accountId: { providerId: UNIAUTH_PROVIDER_ID, accountId: sub },
    },
    select: { user: { select: { id: true, consentGivenAt: true } } },
  });
  return account?.user ?? null;
};

/** The project id for a key prefix such as TG. Membership is checked by the service. */
export const findProjectIdByKey = async (keyPrefix: string) => {
  const project = await prisma.project.findUnique({
    where: { keyPrefix },
    select: { id: true },
  });
  return project?.id;
};

/** The id of a live item, from its project's key prefix and its number (TG-12). */
export const findItemIdByKey = async (keyPrefix: string, number: number) => {
  const item = await prisma.item.findFirst({
    where: { number, deletedAt: null, project: { keyPrefix } },
    select: { id: true },
  });
  return item?.id;
};
