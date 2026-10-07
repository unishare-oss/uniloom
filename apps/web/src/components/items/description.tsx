"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Markdown } from "@/components/markdown/markdown";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/** Rendered description; Edit opens Write / Preview with Save and Cancel. */
export const Description = ({
  value,
  saving,
  onSave,
}: {
  value: string;
  saving: boolean;
  onSave: (description: string) => Promise<unknown>;
}) => {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <section
        aria-labelledby="description"
        className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="description" className="font-semibold">
            Description
          </h2>
          <Button variant="secondary" onClick={() => setDraft(value)}>
            <Pencil />
            Edit
          </Button>
        </div>
        {value.trim() ? (
          <Markdown>{value}</Markdown>
        ) : (
          <button
            type="button"
            onClick={() => setDraft("")}
            className="rounded-md border border-dashed p-4 text-left text-muted-foreground transition-colors duration-150 ease-out outline-none hover:border-ring/60 hover:bg-muted hover:text-foreground focus-visible:border-ring/60 focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Add a description: Markdown, tables, task lists and ```mermaid
            diagrams.
          </button>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="description"
      className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
    >
      <h2 id="description" className="font-semibold">
        Description
      </h2>
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent
          value="write"
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        >
          <Textarea
            aria-label="Description, in Markdown"
            rows={14}
            autoFocus
            className="font-mono text-[13px]"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </TabsContent>
        <TabsContent
          value="preview"
          className="min-h-40 rounded-md border p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        >
          {draft.trim() ? (
            <Markdown>{draft}</Markdown>
          ) : (
            <p className="text-muted-foreground">Nothing to preview.</p>
          )}
        </TabsContent>
      </Tabs>
      <div className="flex items-center justify-end gap-2">
        {draft !== value && (
          <span className="mr-auto text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
            Unsaved changes
          </span>
        )}
        <Button variant="outline" onClick={() => setDraft(null)}>
          Cancel
        </Button>
        <Button
          disabled={saving}
          onClick={() => void onSave(draft).then(() => setDraft(null))}
        >
          Save
        </Button>
      </div>
    </section>
  );
};
