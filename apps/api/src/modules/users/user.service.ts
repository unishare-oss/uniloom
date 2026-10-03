import type { SessionUser } from '@/auth/auth.js';
import { findConsent, setConsentIfMissing } from './user.repository.js';

/** What the web app sees of the signed-in user. */
export function toMe(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    image: user.image ?? null,
    consentGivenAt: user.consentGivenAt ?? null,
  };
}

/** Records consent once. A second call keeps the first timestamp. */
export async function giveConsent(userId: string) {
  await setConsentIfMissing(userId);
  return findConsent(userId);
}
