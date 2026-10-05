import { ArrowRight, Github, Menu } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/shell/logo";
import { GITHUB_URL } from "./links";

const linkClass =
  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground";

export const LandingNav = () => {
  return (
    <header className="sticky top-0 z-10 border-b-2 border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-300 items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-7">
          <Link
            href="/"
            aria-label="Uniloom home"
            className="flex items-center gap-2.5"
          >
            <span className="flex size-9 items-center justify-center rounded-[10px] border-2 border-ink bg-accent text-primary">
              <LogoMark className="size-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              Uniloom
            </span>
            <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
              OSS
            </span>
          </Link>
          <nav
            aria-label="Sections"
            className="hidden items-center gap-1 lg:flex"
          >
            <a href="#features" className={linkClass}>
              Features
            </a>
            <a href="#how" className={linkClass}>
              How it works
            </a>
            <a href="#self-host" className={linkClass}>
              Self-host
            </a>
            <a href={GITHUB_URL} className={linkClass}>
              <Github className="size-4" />
              GitHub
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <details className="group relative lg:hidden">
            <summary
              aria-label="Menu"
              className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full hover:bg-muted [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-5" />
            </summary>
            <nav
              aria-label="Sections"
              className="absolute right-0 mt-2 flex w-48 flex-col rounded-xl border-2 border-ink bg-background p-2 shadow-hard"
            >
              <a href="#features" className={linkClass}>
                Features
              </a>
              <a href="#how" className={linkClass}>
                How it works
              </a>
              <a href="#self-host" className={linkClass}>
                Self-host
              </a>
              <a href={GITHUB_URL} className={linkClass}>
                <Github className="size-4" />
                GitHub
              </a>
            </nav>
          </details>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-full px-4 text-sm font-bold hover:bg-muted"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-ink bg-primary pr-3.5 pl-4.5 text-sm font-bold text-primary-foreground shadow-[2px_2px_0_var(--ink)]"
          >
            Get started
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
};
