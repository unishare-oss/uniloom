"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/safe-next";
import { signInWithUniauth, silentCheckDone } from "@/lib/uniauth";

const Login = () => {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const next = safeNext(params.get("next"));
  const error = params.get("error");
  // Signed in on another app already? Then the check is instant and the button never shows.
  const [redirecting, setRedirecting] = useState(false);
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
    <div className="flex min-h-screen bg-background">
      <div className="hidden flex-[1_1_520px] flex-col justify-between gap-10 border-r-2 border-ink bg-ink bg-[radial-gradient(rgb(255_255_255/0.1)_1px,transparent_1px)] bg-[size:22px_22px] p-10 text-white lg:flex">
        <Link
          href="/"
          aria-label="Uniloom home"
          className="flex items-center gap-2.5"
        >
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-accent text-primary">
            <LogoMark className="size-5" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">Uniloom</span>
        </Link>
        <blockquote className="max-w-140">
          <p className="text-[44px] leading-[1.12] font-extrabold tracking-tighter">
            Agree the design. Then review what was{" "}
            <span className="bg-[linear-gradient(transparent_64%,var(--primary)_64%,var(--primary)_92%,transparent_92%)]">
              built against it
            </span>
            .
          </p>
        </blockquote>
        <span className="font-mono text-xs font-semibold tracking-[0.12em] text-white/60 uppercase">
          Slices are threads · Features are the fabric
        </span>
      </div>

      <main className="flex min-w-0 flex-[1_1_420px] items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-90 flex-col gap-6">
          <Link
            href="/"
            aria-label="Uniloom home"
            className="flex items-center justify-center gap-2.5 lg:hidden"
          >
            <span className="flex size-9 items-center justify-center rounded-[10px] border-2 border-ink bg-accent text-primary">
              <LogoMark className="size-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              Uniloom
            </span>
          </Link>
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-[28px] font-bold tracking-tight">Sign in</h1>
            <p className="text-sm leading-normal text-muted-foreground">
              One uniAuth account for Uniloom and every other UniCorp app
            </p>
          </div>
          <Button
            disabled={redirecting}
            onClick={() => {
              setRedirecting(true);
              void signInWithUniauth({
                returnTo: `${window.location.origin}${next}`,
              });
            }}
            className="h-12 gap-2 rounded-xl border-2 border-ink text-base font-bold shadow-hard"
          >
            {redirecting ? (
              "Redirecting…"
            ) : (
              <>
                Continue
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
          {error && error !== "login_required" && (
            <p
              role="alert"
              className="rounded-[10px] bg-destructive/10 px-3 py-2.5 text-center text-[13px] text-destructive"
            >
              Sign-in failed ({error}). Please try again.
            </p>
          )}
          <p className="text-center text-xs leading-normal text-muted-foreground">
            By continuing you agree to Uniloom&rsquo;s{" "}
            <Link href="/terms" className="underline underline-offset-4">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="h-0.5 bg-border" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 self-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Login;
