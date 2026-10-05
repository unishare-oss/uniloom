import {
  BookOpen,
  LayoutGrid,
  ListChecks,
  PenLine,
  Terminal,
  Activity,
  type LucideIcon,
} from "lucide-react";

const features: {
  icon: LucideIcon;
  tile: string;
  title: string;
  text: string;
}[] = [
  {
    icon: PenLine,
    tile: "bg-accent text-primary",
    title: "Design before code",
    text: "Each slice lists its functions, what each does and why, plus the flows. A person approves it before it moves to Ready.",
  },
  {
    icon: ListChecks,
    tile: "bg-state-done/15 text-state-done",
    title: "Checklists",
    text: "Three to six concrete items per slice, ticked the moment they're met. Small slices keep the agent on track.",
  },
  {
    icon: Terminal,
    tile: "bg-project/15 text-project",
    title: "Agents over MCP",
    text: "Your agent creates features, slices, designs and records from the terminal. It can't approve: only people can.",
  },
  {
    icon: Activity,
    tile: "bg-feature/15 text-feature",
    title: "Planned vs actual",
    text: "Review the approved design next to what was built: the checklist, the commits and what changed on the way.",
  },
  {
    icon: BookOpen,
    tile: "bg-accent text-primary",
    title: "ADRs, linked",
    text: "Decisions that outlive a slice get an ADR. Designs link to it instead of repeating the reasoning.",
  },
  {
    icon: LayoutGrid,
    tile: "bg-muted text-muted-foreground",
    title: "Standard or Guided",
    text: "Run a workspace like Jira, or turn on the design-first flow. Bugs and chores can skip the design.",
  },
];

export const LandingFeatures = () => {
  return (
    <section
      id="features"
      className="mx-auto max-w-300 scroll-mt-16 px-5 py-18"
    >
      <div className="mx-auto mb-10 flex max-w-170 flex-col gap-2.5 text-center">
        <span className="font-mono text-xs font-semibold tracking-[0.14em] text-accent-foreground uppercase">
          Why Uniloom
        </span>
        <h2 className="text-4xl leading-tight font-extrabold tracking-tight">
          You navigate. The agent drives.
        </h2>
        <p className="leading-relaxed text-muted-foreground">
          Know every function before it&rsquo;s written. When the code arrives,
          you already know what each part is for.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-6">
        {features.map(({ icon: Icon, tile, title, text }) => (
          <div
            key={title}
            className="flex flex-col gap-2.5 rounded-2xl border-2 border-ink bg-card p-5.5 shadow-[5px_5px_0_var(--ink)]"
          >
            <span
              className={`flex size-10 items-center justify-center rounded-[10px] ${tile}`}
            >
              <Icon className="size-5" />
            </span>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
