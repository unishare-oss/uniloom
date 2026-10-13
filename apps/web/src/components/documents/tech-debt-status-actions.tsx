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
  useSetDocumentStatus,
} from "@/lib/api/generated/documents/documents";
import {
  getGetItemQueryKey,
  useListItems,
} from "@/lib/api/generated/items/items";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import type { GetDocument200 } from "@/lib/api/generated/uniloomAPI.schemas";

/**
 * Close an Open tech debt record: Won't fix, or Fixed by a Done ticket picked from the
 * project. Shown to owners and managers only; the API checks the same, and refuses a
 * ticket that isn't Done.
 */
export const TechDebtStatusActions = ({
  projectId,
  document,
}: {
  projectId: string;
  document: GetDocument200;
}) => {
  const queryClient = useQueryClient();
  const [fixerId, setFixerId] = useState<string | null>(null);
  const open = document.status === "OPEN";
  const { data: doneStateIds = [] } = useGetProject(projectId, {
    query: {
      select: (r) =>
        r.data.states
          .filter((state) => state.category === "DONE")
          .map((state) => state.id),
      enabled: open,
    },
  });
  const { data: tickets = [] } = useListItems(projectId, {
    query: {
      select: (r) =>
        r.data.filter((item) => doneStateIds.includes(item.state.id)),
      enabled: open,
    },
  });
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
          // The fixing ticket now lists the debt under Related.
          ...(fixerId
            ? [
                queryClient.invalidateQueries({
                  queryKey: getGetItemQueryKey(fixerId),
                }),
              ]
            : []),
        ]);
      },
      onError: (err) => toast.error(err.message),
    },
  });

  if (!open) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={fixerId}
        onValueChange={(value) => setFixerId(value as string | null)}
        items={tickets.map((ticket) => ({
          value: ticket.id,
          label: `${ticket.key}: ${ticket.title}`,
        }))}
        disabled={tickets.length === 0}
      >
        <SelectTrigger aria-label="Fixing ticket" className="h-9 w-72">
          <SelectValue
            placeholder={
              tickets.length ? "Fixed by…" : "No Done ticket to name yet"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {tickets.map((ticket) => (
            <SelectItem key={ticket.id} value={ticket.id}>
              {ticket.key}: {ticket.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        disabled={change.isPending || fixerId === null}
        onClick={() =>
          change.mutate({
            id: document.id,
            data: {
              status: "FIXED",
              ...(fixerId && { fixedByItemId: fixerId }),
            },
          })
        }
      >
        <Check />
        Mark fixed
      </Button>
      <Button
        variant="outline"
        disabled={change.isPending}
        onClick={() =>
          change.mutate({ id: document.id, data: { status: "WONT_FIX" } })
        }
      >
        <X />
        Won&apos;t fix
      </Button>
    </div>
  );
};
