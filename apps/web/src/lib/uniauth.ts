import { authClient } from "./auth-client";

/** uniAuth's origin, e.g. https://auth.psstee.dev (baked in at build time). */
export const uniauthURL =
  process.env.NEXT_PUBLIC_UNIAUTH_URL ?? "http://localhost:3002";

// A signed-out visitor is checked silently at most once per 10 minutes.
const CHECKED_COOKIE = "uniloom_uniauth_checked";
const RETURN_KEY = "uniloom:return-to";

export const silentCheckDone = () => {
  if (/bot|crawl|spider|preview/i.test(navigator.userAgent)) return true;
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith(`${CHECKED_COOKIE}=`));
};

/**
 * Sends the visitor to uniAuth and back to `returnTo`. `silent` uses prompt=none: no page is
 * shown, and they come back signed in or to /auth/return?error=login_required.
 * signIn.social navigates by itself. Don't navigate again afterwards: the code exchange
 * would fail with invalid_grant.
 */
export const signInWithUniauth = async ({
  returnTo,
  errorReturnTo,
  silent = false,
}: {
  returnTo: string;
  errorReturnTo?: string;
  silent?: boolean;
}) => {
  document.cookie = `${CHECKED_COOKIE}=1; Max-Age=600; Path=/; SameSite=Lax`;
  sessionStorage.setItem(RETURN_KEY, errorReturnTo ?? returnTo);
  await authClient.signIn.social({
    provider: "uniauth",
    callbackURL: returnTo,
    errorCallbackURL: `${window.location.origin}/auth/return`,
    ...(silent && { additionalParams: { prompt: "none" } }),
  });
};

/** Where a sign-in started. Same origin only, because this value decides a redirect. */
export const takeReturnTo = () => {
  const value = sessionStorage.getItem(RETURN_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  return value &&
    new URL(value, window.location.origin).origin === window.location.origin
    ? value
    : null;
};

/** Ends Uniloom's session, then uniAuth's, which signs the person out of every app. */
export const signOutEverywhere = async () => {
  await authClient.signOut();
  // uniAuth's /logout page, not the OIDC end-session endpoint: without an id_token_hint
  // that shows an unstyled confirmation page.
  const logout = new URL("/logout", uniauthURL);
  logout.searchParams.set("redirect", `${window.location.origin}/`);
  window.location.assign(logout);
};

/** uniAuth's account page (name, avatar, password, linked accounts), then back to `returnTo`. */
export const uniauthAccountURL = (returnTo: string) => {
  const account = new URL("/account", uniauthURL);
  account.searchParams.set("redirect", returnTo);
  return account.toString();
};
