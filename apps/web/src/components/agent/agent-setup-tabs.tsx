"use client";

import { CopyBlock } from "@/components/agent/copy-block";
import { agentSetups } from "@/components/agent/agent-setups";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Boxed tabs that wrap onto more lines on a phone.
const listClass =
  "w-full flex-wrap justify-start gap-1.5 bg-transparent p-0 group-data-horizontal/tabs:h-auto";
const triggerClass =
  "h-8 flex-none rounded-lg border-border bg-card px-3 text-foreground hover:bg-muted data-active:border-primary data-active:bg-accent data-active:font-semibold data-active:text-accent-foreground dark:text-foreground dark:data-active:border-primary dark:data-active:bg-accent dark:data-active:text-accent-foreground";

/** One tab per agent; each lists the steps to add Uniloom and sign in. */
export const AgentSetupTabs = ({ serverUrl }: { serverUrl: string }) => {
  const setups = agentSetups(serverUrl);

  return (
    <Tabs defaultValue={setups[0].id} className="gap-3.5">
      <TabsList className={listClass}>
        {setups.map((setup) => (
          <TabsTrigger key={setup.id} value={setup.id} className={triggerClass}>
            {setup.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {setups.map((setup) => (
        <TabsContent
          key={setup.id}
          value={setup.id}
          className="flex flex-col gap-4 rounded-xl border-2 border-ink bg-card p-4 shadow-hard sm:p-5"
        >
          {setup.steps.map((step, index) => (
            <div key={step.title} className="grid grid-cols-[26px_1fr] gap-3">
              <span className="flex size-6.5 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-2">
                <b className="font-semibold">{step.title}</b>
                <span className="font-mono text-xs text-muted-foreground">
                  {step.where}
                </span>
                {step.text && <CopyBlock text={step.text} />}
                {step.note && (
                  <p className="text-muted-foreground">{step.note}</p>
                )}
              </div>
            </div>
          ))}
          {setup.config && (
            <details className="text-[13px] text-muted-foreground">
              <summary className="cursor-pointer">
                Or edit the config file
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <span className="font-mono text-xs">{setup.config.where}</span>
                <CopyBlock text={setup.config.text} />
              </div>
            </details>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
};
