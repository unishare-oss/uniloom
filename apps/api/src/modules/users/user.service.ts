import * as userRepo from './user.repository.js';

/** Records consent once. A second call keeps the first timestamp. */
export const giveConsent = async (userId: string) => {
  await userRepo.setConsentIfMissing(userId);
  return userRepo.findConsent(userId);
};
