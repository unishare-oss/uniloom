import Link from "next/link";
import type { ReactNode } from "react";

/** Layout for the Terms and Privacy pages. Reachable signed out. */
export const LegalPage = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        &larr; Uniloom
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
        Draft. This text is a placeholder until the approved version is
        published.
      </p>
      <div className="space-y-4 text-sm leading-6 [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground">
        {children}
      </div>
    </main>
  );
};
