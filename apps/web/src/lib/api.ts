/** Sends the visitor to the consent screen, then back to the current page. */
export function goToConsent() {
  const { pathname, search } = window.location;
  window.location.replace(
    `/consent?next=${encodeURIComponent(`${pathname}${search}`)}`,
  );
}
