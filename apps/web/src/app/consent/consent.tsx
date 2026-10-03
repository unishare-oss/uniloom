"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";
import { signOutEverywhere } from "@/lib/uniauth";

/** Back to login, then here again with the same `next`. */
function goToLogin() {
  const { pathname, search } = window.location;
  window.location.replace(
    `/login?next=${encodeURIComponent(`${pathname}${search}`)}`,
  );
}

/** Signing in through uniAuth is not agreeing to Uniloom's terms: this asks once. */
export default function Consent() {
  const [next] = useState(() =>
    safeNext(new URLSearchParams(window.location.search).get("next")),
  );
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void authClient.getSession().then(({ data }) => {
      if (!data) return goToLogin();
      const { consentGivenAt } = data.user as { consentGivenAt?: unknown };
      if (consentGivenAt) return window.location.replace(next);
      setReady(true);
    });
  }, [next]);

  async function agree() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/api/users/me/consent", {
        method: "POST",
      });
      if (response.ok) return window.location.replace(next);
      if (response.status === 401) return goToLogin();
      setError("Something went wrong. Please try again.");
    } catch {
      setError("Couldn't reach Uniloom. Check your connection and try again.");
    }
    setBusy(false);
  }

  if (!ready) return null;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Before you continue
        </h1>
        <p className="text-sm text-muted-foreground">
          To use Uniloom, please read and accept our{" "}
          <a href="/terms" className="underline underline-offset-4">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </a>
          . Your uniAuth account is shared with other apps, but these terms are
          Uniloom&rsquo;s own.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button size="lg" disabled={busy} onClick={() => void agree()}>
          I agree
        </Button>
        <Button
          size="lg"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void signOutEverywhere();
          }}
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}
