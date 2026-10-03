"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { goToConsent } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { signInWithUniauth, silentCheckDone } from "@/lib/uniauth";

// These pages run their own sign-in flow.
const OWN_SIGN_IN = (path: string) =>
  path === "/login" || path.startsWith("/auth/");
// A user without consent can still read these.
const NO_CONSENT_NEEDED = (path: string) =>
  OWN_SIGN_IN(path) || ["/consent", "/terms", "/privacy"].includes(path);

/**
 * On every page, including client-side navigations, reads the session once:
 * - Signed in without consent → the consent screen, then back here.
 * - Signed in → nothing. The read itself slides the session to 7 more days at most once a
 *   day (the API's updateAge) and refreshes the cookie with it.
 * - Signed out → a silent check on uniAuth, at most once per 10 minutes. They come back to
 *   the same page signed in or still signed out.
 */
export function AuthBootstrap() {
  const pathname = usePathname();
  // Once per page: a second sign-in start would make the code exchange fail with
  // invalid_grant (React Strict Mode runs effects twice in dev).
  const checked = useRef<string | null>(null);
  useEffect(() => {
    if (checked.current === pathname) return;
    checked.current = pathname;
    if (OWN_SIGN_IN(pathname)) return;
    void authClient.getSession().then(({ data }) => {
      if (data) {
        const { consentGivenAt } = data.user as { consentGivenAt?: unknown };
        if (!consentGivenAt && !NO_CONSENT_NEEDED(pathname)) goToConsent();
        return;
      }
      if (silentCheckDone()) return;
      void signInWithUniauth({ returnTo: window.location.href, silent: true });
    });
  }, [pathname]);
  return null;
}
