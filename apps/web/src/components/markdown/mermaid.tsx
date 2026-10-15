"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";
import { Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * A ```mermaid block drawn as a diagram. Mermaid is large, so it is loaded the first time
 * a page shows a diagram. `strict` keeps scripts and HTML labels out of diagrams.
 */
export const Mermaid = ({ chart }: { chart: string }) => {
  const { resolvedTheme } = useTheme();
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<{
    chart?: string;
    theme?: string;
    svg?: string;
    failed?: boolean;
  }>({});

  useEffect(() => {
    let current = true;
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        suppressErrorRendering: true,
        securityLevel: "strict",
        theme: resolvedTheme === "dark" ? "dark" : "neutral",
      });
      try {
        const { svg } = await mermaid.render(id, chart);
        if (current) setResult({ svg, chart, theme: resolvedTheme });
      } catch {
        if (current) setResult({ failed: true, chart, theme: resolvedTheme });
      }
    });
    return () => {
      current = false;
    };
  }, [chart, id, resolvedTheme]);

  const current = result.chart === chart && result.theme === resolvedTheme;
  if (current && result.failed) {
    return (
      <div className="flex flex-col gap-1">
        <pre>{chart}</pre>
        <p className="text-xs text-destructive">
          This diagram has a Mermaid syntax error.
        </p>
      </div>
    );
  }
  if (!current || !result.svg)
    return <div className="h-24 animate-pulse rounded-md bg-muted" />;
  return (
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <div className="markdown-diagram">
        <div className="flex justify-end border-b p-1">
          <DialogTrigger render={<Button variant="ghost" size="sm" />}>
            <Expand aria-hidden="true" /> Expand diagram
          </DialogTrigger>
        </div>
        {!expanded && (
          <div
            className="markdown-diagram-preview"
            dangerouslySetInnerHTML={{ __html: result.svg }}
          />
        )}
        {expanded && (
          <p className="p-4 text-sm text-muted-foreground">
            Diagram opened in expanded view.
          </p>
        )}
      </div>
      <DialogContent className="w-[calc(100%-2rem)] max-w-none sm:max-w-[90vw]">
        <DialogTitle>Expanded diagram</DialogTitle>
        <DialogDescription>
          Scroll to explore the diagram. Press Escape to close.
        </DialogDescription>
        {expanded && (
          <div
            className="markdown-diagram-expanded"
            dangerouslySetInnerHTML={{ __html: result.svg }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
