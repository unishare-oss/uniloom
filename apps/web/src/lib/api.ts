/** Sends the visitor to the consent screen, then back to the current page. */
export function goToConsent() {
  const { pathname, search } = window.location;
  window.location.replace(
    `/consent?next=${encodeURIComponent(`${pathname}${search}`)}`,
  );
}

/**
 * fetch for Uniloom's API. A 403 consent_required (the user hasn't accepted the terms yet)
 * sends them to /consent. The response is returned either way. Successful bodies are
 * `{ success: true, message, data }`; errors are `{ success: false, statusCode, code, message }`.
 */
export async function apiFetch(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  if (response.status === 403) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { code?: string } | null;
    if (body?.code === "consent_required") goToConsent();
  }
  return response;
}
