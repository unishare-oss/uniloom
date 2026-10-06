import * as uniauthRepo from './uniauth.repository.js';

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
