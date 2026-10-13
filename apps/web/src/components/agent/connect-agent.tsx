"use client";

import Link from "next/link";
import { AgentSetupTabs } from "@/components/agent/agent-setup-tabs";
import { CopyBlock } from "@/components/agent/copy-block";

const signInSteps = [
  {
    title: "1. First use",
    text: "Your agent finds Uniloom's sign-in page and opens it in your browser.",
  },
  {
    title: "2. Sign in with uniAuth",
    text: "Use the same account as this website and approve access.",
  },
  {
    title: "3. Back to your agent",
    text: "The agent now works as you.",
  },
];

const agentCan = [
  "List projects, items, states and labels",
  "Create features, slices and tasks",
  "Edit items, tick done-when items, move work",
  "Everything your project role allows, nothing more",
];

// MVP.md §9: these steps stay with people.
const peopleOnly = [
  "Approve a design",
  "Accept an ADR",
  "Move work to Ready",
  "Move work to Done",
];

/** How to connect a coding agent to Uniloom's MCP server at <this site>/mcp. */
const ConnectAgent = () => {
  // The web app proxies /mcp to the API, so the address is this site's own.
  const serverUrl = `${window.location.origin}/mcp`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-9 px-4 pt-12 pb-20 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-[13px] text-muted-foreground">
          <Link
            href="/profile"
            className="hover:text-foreground hover:underline"
          >
            Profile
          </Link>{" "}
          / Connect an agent
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-balance">
          Connect an agent
        </h1>
        <p className="max-w-[62ch] text-sm text-muted-foreground">
          Let your coding agent read and update your Uniloom work from your
          editor or terminal. It signs in as you and only sees the projects you
          can see. There&rsquo;s no token to copy: you sign in once in your
          browser.
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Server
          </span>
          <CopyBlock text={serverUrl} />
        </div>
      </header>

      <section aria-labelledby="agent-setup" className="flex flex-col gap-3">
        <h2 id="agent-setup" className="text-lg font-semibold">
          Set up your agent
        </h2>
        <AgentSetupTabs serverUrl={serverUrl} />
      </section>

      <section aria-labelledby="agent-sign-in" className="flex flex-col gap-3">
        <h2 id="agent-sign-in" className="text-lg font-semibold">
          How sign-in works
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {signInSteps.map((step) => (
            <div
              key={step.title}
              className="flex flex-col gap-1 rounded-lg border p-3.5"
            >
              <b className="font-semibold">{step.title}</b>
              <span className="text-[13px] text-muted-foreground">
                {step.text}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="agent-can" className="flex flex-col gap-3">
        <h2 id="agent-can" className="text-lg font-semibold">
          What your agent can do
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border px-4 py-3.5">
            <span className="rounded-full border border-state-done px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-state-done uppercase">
              Agent
            </span>
            <ul className="mt-2.5 flex list-disc flex-col gap-1 pl-4.5 text-sm">
              {agentCan.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border px-4 py-3.5">
            <span className="rounded-full border border-state-review px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-state-review uppercase">
              People only
            </span>
            <ul className="mt-2.5 flex list-disc flex-col gap-1 pl-4.5 text-sm">
              {peopleOnly.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="agent-try" className="flex flex-col gap-3">
        <h2 id="agent-try" className="text-lg font-semibold">
          Try it
        </h2>
        <p className="text-sm text-muted-foreground">
          Once connected, ask your agent:
        </p>
        <p className="rounded-lg bg-muted px-3.5 py-3 font-mono text-[13px]">
          List my open items and tell me what&rsquo;s blocked.
        </p>
      </section>
    </main>
  );
};

export default ConnectAgent;
