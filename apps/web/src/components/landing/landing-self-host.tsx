import { GITHUB_URL } from "./links";

export const LandingSelfHost = () => {
  return (
    <section
      id="self-host"
      className="mx-auto flex max-w-300 scroll-mt-16 flex-wrap items-center gap-10 px-5 py-18"
    >
      <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
        <span className="font-mono text-xs font-semibold tracking-[0.14em] text-accent-foreground uppercase">
          Self-host
        </span>
        <h2 className="text-4xl leading-tight font-extrabold tracking-tight">
          Your server, your data
        </h2>
        <p className="leading-relaxed text-muted-foreground">
          PostgreSQL, the API and the website in one Docker Compose file. Open
          source, so you can read every line.
        </p>
        <a
          href={GITHUB_URL}
          className="inline-flex h-11 items-center self-start rounded-xl border-2 border-ink bg-background px-4.5 text-sm font-bold shadow-[3px_3px_0_var(--ink)]"
        >
          Read the README
        </a>
      </div>
      <div className="min-w-0 flex-[1_1_420px] overflow-x-auto rounded-[14px] border-2 border-ink bg-ink text-white shadow-[6px_6px_0_var(--primary)]">
        <div className="flex gap-1.5 border-b border-white/20 px-3.5 py-3">
          <span className="size-2.5 rounded-full bg-white/40" />
          <span className="size-2.5 rounded-full bg-white/40" />
          <span className="size-2.5 rounded-full bg-white/40" />
        </div>
        <pre className="px-5 py-4.5 font-mono text-[13px] leading-[1.7]">
          <span className="text-white/60">$</span> git clone {GITHUB_URL}
          {"\n"}
          <span className="text-white/60">$</span> cd uniloom{"  "}
          <span className="text-white/60">
            # set the env vars from README.md
          </span>
          {"\n"}
          <span className="text-white/60">$</span> docker compose up -d
          {"\n"}
          <span className="text-state-done">✓</span> postgres{"  "}
          <span className="text-state-done">✓</span> api{"  "}
          <span className="text-state-done">✓</span> web
        </pre>
      </div>
    </section>
  );
};
