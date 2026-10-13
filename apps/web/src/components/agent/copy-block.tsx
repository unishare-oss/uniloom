"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Text in a monospace box with a Copy button. */
export const CopyBlock = ({ text }: { text: string }) => {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it by hand.");
    }
  };

  return (
    <div className="relative rounded-lg border bg-muted">
      <pre className="overflow-x-auto py-3 text-foreground pr-20 pl-3.5 font-mono text-[12.5px] leading-relaxed">
        {text}
      </pre>
      <Button
        size="sm"
        variant="outline"
        className="absolute top-2 right-2"
        onClick={() => void copy()}
      >
        Copy
      </Button>
    </div>
  );
};
