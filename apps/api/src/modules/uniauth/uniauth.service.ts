import { apiError } from '@/http.js';
import type { LocalIdentity } from './directory.client.js';
import * as uniauthRepo from './uniauth.repository.js';

/**
 * The local user for a uniAuth account, created if the person never signed in here. Both
 * add-by-email and the OAuth sign-in call this, so they meet at the same row: it is keyed by
 * the uniAuth `sub` on the account link, never by email, and the database's unique
 * constraints settle a race between callers.
 *
 * - Already linked: that user (with `refresh`, their name, email and avatar are brought up to
 *   date from the directory's answer).
 * - Not linked: create user and link together. Losing a race to another caller means that
 *   caller's transaction committed before our insert failed (it held the unique index), so
 *   one read finds its link. No polling.
 * - The email is taken and no link appears: it belongs to a different local user. Never
 *   attached silently: 409 `identity_conflict`, for a person to reconcile.
 */
export const ensureLocalUser = async (
  identity: LocalIdentity,
  refresh = false,
) => {
  const linked = await uniauthRepo.findUserIdBySub(identity.id);
  if (linked) {
    if (refresh) await refreshUser(linked, identity);
    return linked;
  }
  const created = await uniauthRepo.createLinkedUser(identity);
  if ('userId' in created) return created.userId;
  const winner = await uniauthRepo.findUserIdBySub(identity.id);
  if (winner) return winner;
  throw apiError(
    409,
    'identity_conflict',
    'A different Uniloom user already has that email. Ask a uniAuth admin to reconcile the accounts.',
  );
};

/** Writes the directory's name, email and avatar over the local copy, only where they differ. */
const refreshUser = async (userId: string, identity: LocalIdentity) => {
  const user = await uniauthRepo.findUserById(userId);
  if (!user) return;
  const email = identity.email.toLowerCase();
  const image = identity.image || null;
  if (
    user.name === identity.name &&
    user.email === email &&
    user.image === image &&
    user.emailVerified === identity.emailVerified
  )
    return;
  await uniauthRepo
    .updateUserById(userId, {
      image,
      name: identity.name || user.name,
      email,
      emailVerified: identity.emailVerified,
    })
    // An email another local user holds is for a person to reconcile, not for an add to fail on.
    .catch((error: unknown) => {
      console.error(
        '[uniauth] could not refresh the local user:',
        String(error),
      );
    });
};

// Each applies a uniAuth event to Uniloom's copy of a person. An unknown sub is a no-op.

/** Back-channel logout: uniAuth signed the person out everywhere. */
export const endSessions = async (sub: string) => {
  const userId = await uniauthRepo.findUserIdBySub(sub);
  if (userId) await uniauthRepo.deleteSessions(userId);
};

export const deleteUser = async (sub: string) => {
  const userId = await uniauthRepo.findUserIdBySub(sub);
  if (userId) await uniauthRepo.deleteUserById(userId);
};

/** Refreshes name, email and avatar. An empty name or email keeps the current one. */
export const updateUser = async (
  sub: string,
  data: Record<string, unknown>,
) => {
  const userId = await uniauthRepo.findUserIdBySub(sub);
  if (!userId) return;
  const { name, email, email_verified, picture } = data;
  await uniauthRepo.updateUserById(userId, {
    // No picture = avatar removed.
    image: typeof picture === 'string' && picture ? picture : null,
    ...(typeof name === 'string' && name && { name }),
    ...(typeof email === 'string' && email && { email: email.toLowerCase() }),
    ...(typeof email_verified === 'boolean' && {
      emailVerified: email_verified,
    }),
  });
};
