import type { SessionUser } from '@/auth/auth.js';

/** What the web app sees of the signed-in user. */
export const toMe = (user: SessionUser) => {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    image: user.image ?? null,
    consentGivenAt: user.consentGivenAt ?? null,
  };
};
