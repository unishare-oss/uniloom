import { GuideAgentStep } from "@/components/guide/guide-agent-step";
import { GuideDocsSteps } from "@/components/guide/guide-docs-steps";
import { GuideProjectSteps } from "@/components/guide/guide-project-steps";
import { GuideSettingsStep } from "@/components/guide/guide-settings-step";
import { GuideTeamSteps } from "@/components/guide/guide-team-steps";

const contents = [
  { id: "projects", title: "Create a project" },
  { id: "board", title: "Use the board" },
  { id: "ticket", title: "Work on a ticket" },
  { id: "roles", title: "Members and roles" },
  { id: "rules", title: "Workflow rules" },
  { id: "reviews", title: "Review inbox" },
  { id: "docs", title: "Knowledge" },
  { id: "guided-docs", title: "Specs, ADRs and tech debt" },
  { id: "agent", title: "Connect your agent" },
  { id: "settings", title: "Settings, labels and trash" },
];

/** The user guide: intro, contents and the ten steps. */
export const Guide = () => {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-12 pb-20 text-sm leading-6 sm:px-6 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1.5 [&_ol]:pl-5 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-balance">
          Uniloom user guide
        </h1>
        <p className="max-w-[62ch] text-muted-foreground">
          Uniloom is a work tracker for teams who build software with a coding
          agent. Your agent creates and updates tickets from the terminal. The
          website is where people read, assign and review the work.
        </p>
      </header>

      <nav aria-label="Contents" className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 font-semibold">Contents</h2>
        <ol>
          {contents.map((entry) => (
            <li key={entry.id}>
              <a href={`#${entry.id}`} className="hover:underline">
                {entry.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <GuideProjectSteps />
      <GuideTeamSteps />
      <GuideDocsSteps />
      <GuideAgentStep />
      <GuideSettingsStep />
    </main>
  );
};
