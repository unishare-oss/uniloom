"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";

/**
 * A ```mermaid block drawn as a diagram. Mermaid is large, so it is loaded the first time
 * a page shows a diagram. `strict` keeps scripts and HTML labels out of diagrams.
 */
export const Mermaid = ({ chart }: { chart: string }) => {
  const { resolvedTheme } = useTheme();
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [result, setResult] = useState<{ svg?: string; failed?: boolean }>({});

  useEffect(() => {
    let current = true;
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: resolvedTheme === "dark" ? "dark" : "neutral",
      });
      try {
        const { svg } = await mermaid.render(id, chart);
        if (current) setResult({ svg });
      } catch {
        if (current) setResult({ failed: true });
      }
    });
    return () => {
      current = false;
    };
  }, [chart, id, resolvedTheme]);

  if (result.failed) {
    return (
      <div className="flex flex-col gap-1">
        <pre>{chart}</pre>
        <p className="text-xs text-destructive">
          This diagram has a Mermaid syntax error.
        </p>
      </div>
    );
  }
  if (!result.svg)
    return <div className="h-24 animate-pulse rounded-md bg-muted" />;
  return (
    <div
      className="flex justify-center overflow-x-auto rounded-md border bg-card p-4"
      // Mermaid's own output, sanitised by it in strict mode.
      dangerouslySetInnerHTML={{ __html: result.svg }}
    />
  );
};
