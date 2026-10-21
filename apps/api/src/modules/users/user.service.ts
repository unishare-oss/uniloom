import { apiError } from '@/http.js';
import * as userRepo from './user.repository.js';

/** Compatibility endpoint: acceptance is recorded only on UniAuth. */
export const giveConsent = async (userId: string) => {
  const user = await userRepo.findConsent(userId);
  if (user.unicorpTermsVersion !== 1 || !user.unicorpTermsAcceptedAt)
    throw apiError(
      403,
      'consent_required',
      'Complete the shared Unicorp terms step through UniAuth',
    );
  return { consentGivenAt: user.unicorpTermsAcceptedAt };
};
