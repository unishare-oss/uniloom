import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { Prisma } from '@/generated/prisma/client.js';
import { UNIAUTH_PROVIDER_ID } from '@/auth/constants.js';
import type { DirectoryIdentity } from './directory.client.js';

/** Never by email: the uniAuth sub on the account row is the only link. */
export const findUserIdBySub = async (sub: string) => {
  const account = await prisma.account.findUnique({
    where: {
      providerId_accountId: { providerId: UNIAUTH_PROVIDER_ID, accountId: sub },
    },
    select: { userId: true },
  });
  return account?.userId;
};

/**
 * A local user for a uniAuth account that has not signed in here yet, with the account link a
 * first sign-in would have made: no password, no tokens, no accepted terms. The unique email
 * and the unique (provider, sub) pair decide any race: `{ conflict }` says which was taken.
 */
export const createLinkedUser = (identity: DirectoryIdentity) => {
  return prisma
    .$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          name: identity.name || identity.email,
          email: identity.email.toLowerCase(),
          emailVerified: identity.emailVerified,
          image: identity.image,
        },
      });
      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: identity.id,
          providerId: UNIAUTH_PROVIDER_ID,
          userId: user.id,
        },
      });
      return { userId: user.id };
    })
    .catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const where = JSON.stringify(error.meta ?? {});
        // The account link's own unique pair, or else the user's email.
        return {
          conflict: /providerId|accountId|account_/.test(where)
            ? ('link' as const)
            : ('email' as const),
        };
      }
      throw error;
    });
};

export const findUserById = (userId: string) => {
  return prisma.user.findUnique({ where: { id: userId } });
};

export const deleteSessions = (userId: string) => {
  return prisma.session.deleteMany({ where: { userId } });
};

/** Sessions, accounts and memberships go with the user (onDelete: Cascade). */
export const deleteUserById = (userId: string) => {
  return prisma.user.deleteMany({ where: { id: userId } });
};

export const updateUserById = (
  userId: string,
  data: {
    image: string | null;
    name?: string;
    email?: string;
    emailVerified?: boolean;
  },
) => {
  return prisma.user.update({ where: { id: userId }, data });
};
