/** The profile is supplied only after the OIDC signature, issuer and audience checks. */
export const sharedTerms = (profile: Record<string, unknown>) => {
  const value = profile['urn:unicorp:terms'] as
    { version?: unknown; acceptedAt?: unknown } | undefined;
  const time =
    typeof value?.acceptedAt === 'string' ? Date.parse(value.acceptedAt) : NaN;
  return value?.version === 1 && Number.isFinite(time) && time > 0
    ? { unicorpTermsVersion: 1, unicorpTermsAcceptedAt: new Date(time) }
    : { unicorpTermsVersion: null, unicorpTermsAcceptedAt: null };
};
