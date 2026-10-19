import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { Prisma } from '@/generated/prisma/client.js';
import { UNIAUTH_PROVIDER_ID } from '@/auth/constants.js';
import type { DirectoryIdentity, LocalIdentity } from './directory.client.js';

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
export const createLinkedUser = (identity: LocalIdentity) => {
  return prisma
    .$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          name: identity.name || identity.email,
          email: identity.email.toLowerCase(),
          emailVerified: identity.emailVerified,
          image: identity.image,
          ...(identity.version !== undefined && {
            identityVersion: identity.version,
          }),
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

export interface AppliedEvent {
  eventId: string;
  type: string;
  subject: string;
  identityVersion: number;
}

/** What an identity event does to the local user. */
export type IdentityChange =
  | { kind: 'profile'; profile: DirectoryIdentity }
  | { kind: 'suspend' }
  | { kind: 'reactivate' }
  | { kind: 'delete' };

/**
 * Records the event and applies it in ONE transaction, so a retry can never apply it twice and a crash leaves
 * neither half. `duplicate`: this event id was applied before. `stale`: the user already holds an equal or newer
 * identity version (an old update must not undo a newer state, nor resurrect anyone). `gone`: no such user.
 * Suspension ends the person's sessions at once; deletion removes the user (sessions, accounts and memberships go
 * with it, as in the legacy user-deleted notice).
 */
export const recordAndApply = async (
  event: AppliedEvent,
  userId: string,
  change: IdentityChange,
): Promise<'applied' | 'duplicate' | 'stale' | 'gone'> => {
  return prisma.$transaction(async (tx) => {
    // createMany + skipDuplicates: a conflict is not an error, so the transaction stays usable.
    const { count } = await tx.identityEventReceipt.createMany({
      data: [
        {
          eventId: event.eventId,
          subject: event.subject,
          version: event.identityVersion,
          type: event.type,
        },
      ],
      skipDuplicates: true,
    });
    if (count === 0) return 'duplicate';
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return 'gone';
    if (
      user.identityVersion !== null &&
      event.identityVersion <= user.identityVersion
    )
      return 'stale';
    await applyChange(tx, user, event.identityVersion, change);
    return 'applied';
  });
};

const applyChange = async (
  tx: Prisma.TransactionClient,
  user: { id: string; email: string },
  version: number,
  change: IdentityChange,
) => {
  if (change.kind === 'delete') {
    await tx.user.deleteMany({ where: { id: user.id } });
    return;
  }
  if (change.kind === 'profile') {
    const { profile } = change;
    const email = profile.email.toLowerCase();
    // An email another local user holds is for a person to reconcile; the rest of the profile still applies.
    const taken =
      email !== user.email && (await tx.user.count({ where: { email } })) > 0;
    await tx.user.update({
      where: { id: user.id },
      data: {
        name: profile.name || undefined,
        ...(!taken && { email, emailVerified: profile.emailVerified }),
        image: profile.image || null,
        identityVersion: version,
        identityStatus: profile.status === 'suspended' ? 'suspended' : 'active',
      },
    });
    if (profile.status === 'suspended')
      await tx.session.deleteMany({ where: { userId: user.id } });
    return;
  }
  await tx.user.update({
    where: { id: user.id },
    data: {
      identityVersion: version,
      identityStatus: change.kind === 'suspend' ? 'suspended' : 'active',
    },
  });
  if (change.kind === 'suspend')
    await tx.session.deleteMany({ where: { userId: user.id } });
};

/** Every local user with a uniAuth link: the ids a full resync refreshes. */
export const listLinkedSubs = async (after: string | null, take: number) => {
  const accounts = await prisma.account.findMany({
    where: {
      providerId: UNIAUTH_PROVIDER_ID,
      ...(after && { accountId: { gt: after } }),
    },
    select: { accountId: true, userId: true },
    orderBy: { accountId: 'asc' },
    take,
  });
  return accounts;
};

/** Brings one user to the directory's current state (a resync), only if it is newer than what they hold. */
export const applyResync = async (
  userId: string,
  state: DirectoryIdentity | 'deleted',
) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return 'gone' as const;
    if (state === 'deleted') {
      await tx.user.deleteMany({ where: { id: userId } });
      return 'applied' as const;
    }
    // Stale only if the user holds a version at or above the directory's (an unchanged account needs no write).
    if (user.identityVersion !== null && state.version <= user.identityVersion)
      return 'stale' as const;
    await applyChange(tx, user, state.version, {
      kind: 'profile',
      profile: state,
    });
    return 'applied' as const;
  });
};

export const readReconcileCursor = async () => {
  const row = await prisma.identityReconcile.findUnique({ where: { id: 1 } });
  return row?.cursor ?? null;
};

export const saveReconcileCursor = (cursor: string | null) => {
  return prisma.identityReconcile.upsert({
    where: { id: 1 },
    create: { id: 1, cursor },
    update: { cursor },
  });
};
