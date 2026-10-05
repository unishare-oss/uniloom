/** Sends the visitor to the consent screen, then back to the current page. */
export const goToConsent = () => {
  const { pathname, search } = window.location;
  window.location.replace(
    `/consent?next=${encodeURIComponent(`${pathname}${search}`)}`,
  );
};

/** Sends the visitor to sign in, then back to the current page. */
export const goToLogin = () => {
  const { pathname, search } = window.location;
  window.location.replace(
    `/login?next=${encodeURIComponent(`${pathname}${search}`)}`,
  );
};
