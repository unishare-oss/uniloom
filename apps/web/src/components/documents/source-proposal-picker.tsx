"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useListDocuments } from "@/lib/api/generated/documents/documents";

export type SourceProposal = {
  id: string;
  title: string;
  archivedAt: string | null;
};

/** Optional provenance; existing archived selections stay visible until removed. */
export const SourceProposalPicker = ({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: SourceProposal | null;
  onChange: (proposal: SourceProposal | null) => void;
}) => {
  const id = useId();
  const [search, setSearch] = useState("");
  const { data, error, isPending } = useListDocuments(
    projectId,
    { kind: "PROPOSAL", ...(search.trim() && { q: search.trim() }) },
    { query: { select: (r) => r.data } },
  );
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>Based on proposal (optional)</Label>
      <p className="text-sm text-muted-foreground">
        Record where this spec came from. Independent specs are welcome.
      </p>
      {value && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted p-3">
          <span className="min-w-0 break-words text-sm">
            {value.title}
            {value.archivedAt && " (archived)"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        </div>
      )}
      <Input
        id={id}
        placeholder="Search active proposals"
        value={search}
        maxLength={200}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-48 overflow-y-auto rounded-lg border bg-card">
        {error ? (
          <p role="alert" className="p-3 text-sm">
            {error.message}
          </p>
        ) : isPending ? (
          <p role="status" className="p-3 text-sm text-muted-foreground">
            Loading proposals…
          </p>
        ) : data?.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            No active proposals found. You can save without one.
          </p>
        ) : (
          data?.map((proposal) => (
            <button
              key={proposal.id}
              type="button"
              aria-pressed={value?.id === proposal.id}
              onClick={() => onChange(proposal)}
              className="block w-full border-b px-3 py-2 text-left text-sm break-words outline-none last:border-b-0 hover:bg-muted focus-visible:bg-muted aria-pressed:bg-muted"
            >
              {proposal.title}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
