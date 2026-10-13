"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { KindBadge } from "@/components/documents/kind-badge";
import { Input } from "@/components/ui/input";
import { useListDocuments } from "@/lib/api/generated/documents/documents";
import {
  getGetItemQueryKey,
  useLinkDocument,
} from "@/lib/api/generated/items/items";

/** A search box over the project's Knowledge documents; picking one links it to the ticket. */
export const LinkDocumentPicker = ({
  projectId,
  itemId,
  linkedIds,
}: {
  projectId: string;
  itemId: string;
  linkedIds: string[];
}) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const q = search.trim();
  const { data } = useListDocuments(
    projectId,
    { ...(q && { q }) },
    { query: { select: (r) => r.data } },
  );
  const link = useLinkDocument({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetItemQueryKey(itemId),
        });
        setSearch("");
      },
      onError: (err) => toast.error(err.message),
    },
  });
  const options = (data ?? [])
    .filter((document) => !linkedIds.includes(document.id))
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
        <Input
          aria-label="Link a document"
          placeholder="Link a document"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-8"
        />
      </div>
      {q !== "" && (
        <div className="overflow-hidden rounded-lg border bg-card">
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No document to link.
            </p>
          )}
          {options.map((document) => (
            <button
              key={document.id}
              type="button"
              disabled={link.isPending}
              onClick={() =>
                link.mutate({ id: itemId, data: { documentId: document.id } })
              }
              className="flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm outline-none last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50"
            >
              <KindBadge kind={document.kind} />
              <span className="min-w-0 flex-1 truncate">{document.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
