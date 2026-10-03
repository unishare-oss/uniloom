"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/safe-next";
import { signInWithUniauth, silentCheckDone } from "@/lib/uniauth";

export default function Login() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const next = safeNext(params.get("next"));
  const error = params.get("error");
  // Signed in on another app already? Then the check is instant and the button never shows.
  const [checking] = useState(() => !error && !silentCheckDone());

  // Once only: a second sign-in start would break the code exchange (React Strict Mode runs
  // effects twice in dev).
  const started = useRef(false);
  useEffect(() => {
    if (!checking || started.current) return;
    started.current = true;
    void signInWithUniauth({
      returnTo: `${window.location.origin}${next}`,
      // Not signed in on uniAuth: come back here and show the button.
      errorReturnTo: window.location.href,
      silent: true,
    });
  }, [checking, next]);

  if (checking) return null;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign in to Uniloom
        </h1>
        <p className="text-sm text-muted-foreground">
          Use your uniAuth account, the same one you use for other Unishare
          apps.
        </p>
      </div>
      {error && error !== "login_required" && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Sign-in failed ({error}). Please try again.
        </p>
      )}
      <Button
        size="lg"
        onClick={() =>
          void signInWithUniauth({
            returnTo: `${window.location.origin}${next}`,
          })
        }
      >
        Continue
      </Button>
      <p className="text-xs text-muted-foreground">
        By continuing you agree to Uniloom&rsquo;s{" "}
        <a href="/terms" className="underline underline-offset-4">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline underline-offset-4">
          Privacy Policy
        </a>
        .
      </p>
    </main>
  );
}
