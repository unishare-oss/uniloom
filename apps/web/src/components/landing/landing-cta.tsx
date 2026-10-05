import { ArrowRight } from "lucide-react";
import Link from "next/link";

export const LandingCta = () => {
  return (
    <section className="mx-auto max-w-300 px-5 pb-18">
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-[20px] border-2 border-ink bg-primary p-10 text-primary-foreground shadow-[8px_8px_0_var(--ink)]">
        <div className="flex max-w-155 flex-col gap-2">
          <h2 className="text-[34px] leading-tight font-extrabold tracking-tight">
            Weave your next feature with Uniloom
          </h2>
          <p className="leading-relaxed text-primary-foreground/80">
            Sign in with the uniAuth account you already use for other UniCorp
            apps.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex h-12.5 items-center gap-2 rounded-full border-2 border-ink bg-background px-6.5 text-base font-extrabold text-foreground shadow-hard"
        >
          Get started
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
};
