"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/fetcher";
import { useGetMe } from "@/lib/api/generated/users/users";
import { signOutEverywhere, uniauthAccountURL } from "@/lib/uniauth";

/** Who is signed in. Name, email and avatar are uniAuth's: they're edited there. */
export default function Profile() {
  // A 403 consent_required is handled by the fetcher (→ /consent).
  const { data: me, error } = useGetMe({
    query: { select: (r) => r.data, retry: false },
  });
  const [signingOut, setSigningOut] = useState(false);
  const signedOut = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (signedOut) window.location.replace("/login?next=%2Fprofile");
  }, [signedOut]);

  if (error && !signedOut) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
        <p role="alert" className="text-sm text-destructive">
          Couldn&rsquo;t load your profile. Please refresh the page.
        </p>
      </main>
    );
  }
  if (!me) return null;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div className="flex items-center gap-4">
        <Avatar name={me.name} image={me.image} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{me.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{me.email}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Your name, email and picture come from your uniAuth account.
      </p>
      <div className="flex flex-col gap-2">
        <a
          href={uniauthAccountURL(`${window.location.origin}/profile`)}
          className="inline-flex h-9 items-center justify-center rounded-lg border px-2.5 text-sm font-medium hover:bg-muted"
        >
          Manage account
        </a>
        <Button
          size="lg"
          variant="ghost"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOutEverywhere();
          }}
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}
