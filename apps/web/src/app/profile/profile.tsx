"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { signOutEverywhere, uniauthAccountURL } from "@/lib/uniauth";

interface Me {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

/** Who is signed in. Name, email and avatar are uniAuth's: they're edited there. */
export default function Profile() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // A 403 consent_required is handled by apiFetch (→ /consent).
    void apiFetch("/api/me")
      .then(async (response) => {
        if (response.status === 401)
          return window.location.replace("/login?next=%2Fprofile");
        if (!response.ok) return setError(true);
        setMe((await response.json()) as Me);
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
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
