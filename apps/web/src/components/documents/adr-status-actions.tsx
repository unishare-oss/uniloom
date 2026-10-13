"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { successMessage } from "@/lib/api/fetcher";
import {
  getGetDocumentQueryKey,
  getListDocumentsQueryKey,
  useListDocuments,
  useSetDocumentStatus,
} from "@/lib/api/generated/documents/documents";
import type { GetDocument200 } from "@/lib/api/generated/uniloomAPI.schemas";

/**
 * Accept or reject a Proposed ADR; supersede an Accepted one by a newer Accepted ADR.
 * Shown to owners and managers only; the API checks the same.
 */
export const AdrStatusActions = ({
  projectId,
  document,
}: {
  projectId: string;
  document: GetDocument200;
}) => {
  const queryClient = useQueryClient();
  const [newerId, setNewerId] = useState<string | null>(null);
  const accepted = document.status === "ACCEPTED";
  const { data: newer = [] } = useListDocuments(
    projectId,
    { kind: "ADR" },
    {
      query: {
        select: (r) =>
          r.data.filter(
            (adr) =>
              adr.status === "ACCEPTED" &&
              adr.number !== null &&
              document.number !== null &&
              adr.number > document.number,
          ),
        enabled: accepted,
      },
    },
  );
  const change = useSetDocumentStatus({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getGetDocumentQueryKey(document.id),
          }),
          queryClient.invalidateQueries({
            queryKey: getListDocumentsQueryKey(projectId),
          }),
        ]);
      },
      onError: (err) => toast.error(err.message),
    },
  });

  if (document.status === "PROPOSED")
    return (
      <div className="flex gap-2">
        <Button
          disabled={change.isPending}
          onClick={() =>
            change.mutate({ id: document.id, data: { status: "ACCEPTED" } })
          }
        >
          <Check />
          Accept
        </Button>
        <Button
          variant="outline"
          disabled={change.isPending}
          onClick={() =>
            change.mutate({ id: document.id, data: { status: "REJECTED" } })
          }
        >
          <X />
          Reject
        </Button>
      </div>
    );

  if (accepted)
    return (
      <div className="flex items-center gap-2">
        <Select
          value={newerId}
          onValueChange={(value) => setNewerId(value as string | null)}
          items={newer.map((adr) => ({
            value: adr.id,
            label: `ADR-${adr.number}: ${adr.title}`,
          }))}
          disabled={newer.length === 0}
        >
          <SelectTrigger aria-label="Newer ADR" className="h-9 w-64">
            <SelectValue
              placeholder={
                newer.length ? "Superseded by…" : "No newer Accepted ADR"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {newer.map((adr) => (
              <SelectItem key={adr.id} value={adr.id}>
                ADR-{adr.number}: {adr.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          disabled={change.isPending || newerId === null}
          onClick={() =>
            change.mutate({
              id: document.id,
              data: {
                status: "SUPERSEDED",
                ...(newerId && { supersededById: newerId }),
              },
            })
          }
        >
          Supersede
        </Button>
      </div>
    );

  return null;
};
