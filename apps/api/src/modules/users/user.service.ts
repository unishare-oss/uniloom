import { findConsent, setConsentIfMissing } from './user.repository.js';

/** Records consent once. A second call keeps the first timestamp. */
export const giveConsent = async (userId: string) => {
  await setConsentIfMissing(userId);
  return findConsent(userId);
};
