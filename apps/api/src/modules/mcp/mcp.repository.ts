import { UNIAUTH_PROVIDER_ID } from '@/auth/auth.js';
import { prisma } from '@/db/prisma.js';

/** Profiles for already-authorized item assignees, fetched together for lists. */
export const findAssigneeProfiles = (ids: string[]) =>
  prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });

/** The Uniloom user behind a uniAuth sub (through the account row, never by email). */
export const findUserBySub = async (sub: string) => {
  const account = await prisma.account.findUnique({
    where: {
      providerId_accountId: { providerId: UNIAUTH_PROVIDER_ID, accountId: sub },
    },
    select: {
      user: {
        select: { id: true, consentGivenAt: true, identityStatus: true },
      },
    },
  });
  return account?.user ?? null;
};

/** The project id for a key prefix such as TG. Membership is checked by the service. */
export const findProjectIdByKey = async (keyPrefix: string) => {
  const project = await prisma.project.findFirst({
    where: { keyPrefix, deletedAt: null },
    select: { id: true },
  });
  return project?.id;
};

/** The id of a live item, from its project's key prefix and its number (TG-12). */
export const findItemIdByKey = async (keyPrefix: string, number: number) => {
  const item = await prisma.item.findFirst({
    where: { number, deletedAt: null, project: { keyPrefix, deletedAt: null } },
    select: { id: true },
  });
  return item?.id;
};

/** The keys (TG-12) of items, from their ids, in one query. */
export const findItemKeys = async (ids: string[]) => {
  const items = await prisma.item.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      number: true,
      project: { select: { keyPrefix: true } },
    },
  });
  return items.map((item) => ({
    id: item.id,
    key: `${item.project.keyPrefix}-${item.number}`,
  }));
};
