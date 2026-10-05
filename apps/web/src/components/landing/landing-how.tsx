const steps = [
  {
    badge: "bg-ink text-white",
    title: "Talk it through",
    text: "Agree the feature with your agent in the terminal.",
  },
  {
    badge: "bg-ink text-white",
    title: "Agent drafts the slices",
    text: "Each slice lands in Aligning with its checklist and design.",
  },
  {
    badge: "bg-primary text-primary-foreground",
    title: "You approve the design",
    text: "Read it on the website. Approve, and the slice moves to Ready.",
  },
  {
    badge: "bg-state-done text-white",
    title: "Review what was built",
    text: "The agent builds and records; you compare it with the plan.",
  },
];

export const LandingHow = () => {
  return (
    <section
      id="how"
      className="scroll-mt-16 border-y-2 border-border bg-muted"
    >
      <div className="mx-auto flex max-w-300 flex-col gap-9 px-5 py-18">
        <div className="flex max-w-170 flex-col gap-2.5">
          <span className="font-mono text-xs font-semibold tracking-[0.14em] text-accent-foreground uppercase">
            How it works
          </span>
          <h2 className="text-4xl leading-tight font-extrabold tracking-tight">
            From a feature to reviewed code
          </h2>
        </div>
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-5">
          {steps.map(({ badge, title, text }, i) => (
            <li
              key={title}
              className="flex flex-col gap-2.5 rounded-[14px] border-2 border-ink bg-card p-5"
            >
              <span
                className={`flex size-8 items-center justify-center rounded-full font-mono text-[13px] font-semibold ${badge}`}
              >
                {i + 1}
              </span>
              <h3 className="text-base font-bold">{title}</h3>
              <p className="text-sm leading-normal text-muted-foreground">
                {text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
