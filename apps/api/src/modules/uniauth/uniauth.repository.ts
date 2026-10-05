import { prisma } from '@/db/prisma.js';
import { UNIAUTH_PROVIDER_ID } from '@/auth/auth.js';

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
