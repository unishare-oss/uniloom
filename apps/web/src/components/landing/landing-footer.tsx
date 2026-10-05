import Link from "next/link";
import { LogoMark } from "@/components/shell/logo";
import { GITHUB_URL } from "./links";

export const LandingFooter = () => {
  return (
    <footer className="border-t-2 border-ink bg-background">
      <div className="mx-auto flex max-w-300 flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-primary">
            <LogoMark className="size-4" />
          </span>
          <span className="font-extrabold text-foreground">Uniloom</span>
          <span>Open source</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <a href={GITHUB_URL} className="hover:text-foreground">
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
};
