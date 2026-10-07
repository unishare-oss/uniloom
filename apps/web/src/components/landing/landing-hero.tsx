import { ArrowRight, Check, Terminal } from "lucide-react";
import Link from "next/link";
import { KindIcon } from "@/components/items/kind-icon";

const checks = [
  "One uniAuth account",
  "Agents can't approve",
  "Runs on your own server",
];

const columnClass =
  "flex flex-col gap-2 rounded-lg border-t-[3px] bg-column p-2";
const labelClass =
  "font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase";
const cardClass = "flex flex-col gap-1.5 rounded-lg border bg-card p-2.5";
const idClass =
  "flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground";

export const LandingHero = () => {
  return (
    <section className="bg-dots">
      <div className="mx-auto flex max-w-300 flex-wrap items-center gap-12 px-5 pt-16 pb-14">
        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-5.5">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border-2 border-ink bg-background px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wider uppercase">
              Open source · Self-hostable
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 font-mono text-[11px] font-semibold text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Works with any MCP agent
            </span>
          </div>
          <h1 className="text-5xl leading-none font-extrabold tracking-tighter sm:text-[56px]">
            Slices are threads.
            <br />
            <span className="bg-[linear-gradient(transparent_62%,color-mix(in_oklab,var(--primary)_30%,transparent)_62%,color-mix(in_oklab,var(--primary)_30%,transparent)_92%,transparent_92%)]">
              Features are the fabric.
            </span>
          </h1>
          <p className="max-w-135 text-lg leading-relaxed text-muted-foreground">
            A work tracker for building software with a coding agent.{" "}
            <strong className="text-foreground">
              Agree the design before any code
            </strong>
            , then review what was built against it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex h-12.5 items-center gap-2 rounded-full border-2 border-ink bg-primary px-6.5 text-base font-extrabold text-primary-foreground shadow-hard"
            >
              Get started, it&rsquo;s free
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex h-12.5 items-center rounded-full border-2 border-ink bg-background px-6 text-base font-bold"
            >
              See how it works
            </a>
          </div>
          <ul className="flex flex-wrap gap-4.5 text-[13px] text-muted-foreground">
            {checks.map((text) => (
              <li key={text} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-state-done" strokeWidth={2.5} />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 flex-[1_1_440px]" aria-hidden>
          <div className="overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-[8px_8px_0_var(--ink)]">
            <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-3">
              <span className="text-sm font-bold">Uniloom · Board</span>
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-accent-foreground uppercase">
                Guided
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 bg-muted p-3.5">
              <div className={`${columnClass} border-t-state-aligning`}>
                <span className={labelClass}>Aligning 2</span>
                <div className={cardClass}>
                  <span className="text-xs leading-snug font-semibold">
                    Landing page
                  </span>
                  <span className={idClass}>
                    <KindIcon kind="SLICE" />
                    UL-21
                  </span>
                </div>
                <div className={cardClass}>
                  <span className="text-xs leading-snug font-semibold">
                    MCP: create slices
                  </span>
                  <span className={idClass}>
                    <KindIcon kind="SLICE" />
                    UL-22
                  </span>
                </div>
              </div>
              <div className={`${columnClass} border-t-state-active`}>
                <span className={labelClass}>In Progress 1</span>
                <div
                  className={`${cardClass} border-2 border-ink shadow-[3px_3px_0_var(--ink)]`}
                >
                  <span className="text-xs leading-snug font-semibold">
                    Design review page
                  </span>
                  <span className={idClass}>
                    <KindIcon kind="SLICE" />
                    UL-18
                  </span>
                  <span className="h-1 rounded-full bg-[linear-gradient(90deg,var(--primary)_66%,var(--border)_66%)]" />
                  <span className="text-[10px] text-muted-foreground">
                    4 of 6 checklist items
                  </span>
                </div>
              </div>
              <div className={`${columnClass} border-t-state-review`}>
                <span className={labelClass}>In Review 1</span>
                <div className={cardClass}>
                  <span className="text-xs leading-snug font-semibold">
                    Item page
                  </span>
                  <span className={idClass}>
                    <KindIcon kind="SLICE" />
                    UL-17
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Planned vs actual
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 border-t-2 border-ink px-4 py-3 text-xs text-muted-foreground">
              <Terminal className="size-4 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground">Agent</strong> updated the
                design of UL-21. Approval reset.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
