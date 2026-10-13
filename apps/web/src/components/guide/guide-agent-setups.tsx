"use client";

import { useSyncExternalStore } from "react";
import { CopyBlock } from "@/components/agent/copy-block";
import { agentSetups } from "@/components/agent/agent-setups";

const subscribe = () => () => {};

/** Server address and the setup steps of every agent. Client-side: the address is this site's origin. */
export const GuideAgentSetups = () => {
  // Same address as the Connect agent page: this site plus /mcp. The server
  // render has no window, so it shows a placeholder.
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "https://<your-uniloom>",
  );
  const serverUrl = `${origin}/mcp`;

  return (
    <>
      <CopyBlock text={serverUrl} />
      <p>
        Your agent signs in as you with uniAuth, the same account as this
        website. There is no token to copy. The first time you use it, your
        agent opens Uniloom&rsquo;s sign-in page in your browser. Sign in,
        approve access, and go back to your agent.
      </p>
      <p>Pick your agent below.</p>
      {agentSetups(serverUrl).map((setup) => (
        <div key={setup.id} className="flex flex-col gap-3">
          <h3 className="pt-2 font-semibold">{setup.name}</h3>
          <ol>
            {setup.steps.map((step) => (
              <li key={step.title}>
                <b>{step.title}</b>{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {step.where}
                </span>
                {step.text && (
                  <div className="my-2">
                    <CopyBlock text={step.text} />
                  </div>
                )}
                {step.note && (
                  <p className="text-muted-foreground">{step.note}</p>
                )}
              </li>
            ))}
          </ol>
          {setup.config && (
            <>
              <p>
                Or edit <code>{setup.config.where}</code> instead of running the
                add command:
              </p>
              <CopyBlock text={setup.config.text} />
            </>
          )}
        </div>
      ))}
    </>
  );
};
