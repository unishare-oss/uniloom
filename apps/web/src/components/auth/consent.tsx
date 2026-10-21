"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { goToLogin } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";
import { signInWithUniauth } from "@/lib/uniauth";

const REFRESH_KEY = "uniloom:shared-terms-refresh";

/** Older app sessions refresh shared acceptance through UniAuth, which owns the only acceptance step. */
const Consent = () => {
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const next = safeNext(
      new URLSearchParams(window.location.search).get("next"),
    );
    void authClient
      .getSession()
      .then(async ({ data }) => {
        if (!data) return goToLogin();
        const user = data.user as {
          unicorpTermsVersion?: number;
          unicorpTermsAcceptedAt?: unknown;
        };
        if (user.unicorpTermsVersion === 1 && user.unicorpTermsAcceptedAt) {
          sessionStorage.removeItem(REFRESH_KEY);
          return window.location.replace(next);
        }
        if (sessionStorage.getItem(REFRESH_KEY))
          throw new Error(
            "Could not confirm shared acceptance. Please try signing in again.",
          );
        sessionStorage.setItem(REFRESH_KEY, "1");
        await signInWithUniauth({
          returnTo: new URL(next, window.location.origin).href,
        });
      })
      .catch((error: unknown) =>
        setError(
          error instanceof Error
            ? error.message
            : "Could not connect to UniAuth.",
        ),
      );
  }, []);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <p role={error ? "alert" : "status"}>
        {error || "Connecting to your Unicorp account…"}
      </p>
      {error && (
        <Button
          onClick={() => {
            sessionStorage.removeItem(REFRESH_KEY);
            window.location.reload();
          }}
        >
          Try again
        </Button>
      )}
    </main>
  );
};

export default Consent;
