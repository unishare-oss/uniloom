import { apiError } from '@/http.js';
import type { DirectoryIdentity } from './directory.client.js';
import * as uniauthRepo from './uniauth.repository.js';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The local user for a uniAuth account, created if the person never signed in here. Sign-in
 * and this meet at the same row: both are keyed by the uniAuth `sub` on the account link,
 * never by email, and the database's unique constraints settle a race between them.
 *
 * - Already linked: that user.
 * - Not linked: create user and link together. If that loses a race (the person's first
 *   sign-in, or another add) the winner's row is read back; the other writer may still be
 *   committing, so look a few times.
 * - Still no link: the email belongs to a different local user. Never attached silently:
 *   409 `identity_conflict`, for a person to reconcile.
 */
export const ensureLocalUser = async (identity: DirectoryIdentity) => {
  const linked = await uniauthRepo.findUserIdBySub(identity.id);
  if (linked) return linked;
  const created = await uniauthRepo.createLinkedUser(identity);
  if (created) return created;
  for (let attempt = 0; attempt < 5; attempt++) {
    const winner = await uniauthRepo.findUserIdBySub(identity.id);
    if (winner) return winner;
    await wait(100);
  }
  throw apiError(
    409,
    'identity_conflict',
    'A different Uniloom user already has that email. Ask a uniAuth admin to reconcile the accounts.',
  );
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
