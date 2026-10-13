"use client";

import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DOCUMENT_KINDS,
  documentKey,
} from "@/components/documents/document-meta";
import { KindBadge } from "@/components/documents/kind-badge";
import { StatusBadge } from "@/components/documents/status-badge";
import { LinkDocumentPicker } from "@/components/items/link-document-picker";
import { NewTicketDocumentDialog } from "@/components/items/new-ticket-document-dialog";
import { Button } from "@/components/ui/button";
import {
  getGetItemQueryKey,
  useUnlinkDocument,
} from "@/lib/api/generated/items/items";
import type { GetItem200 } from "@/lib/api/generated/uniloomAPI.schemas";
import { cn } from "@/lib/utils";

type Related = GetItem200["related"][number];

/**
 * The documents under a Guided ticket's description: its own and linked ones grouped by
 * kind, then the parent's ("From KEY", read only). The New buttons (the kinds the API lists
 * for the ticket), Link and remove show only when the person can edit the ticket.
 */
export const RelatedDocuments = ({
  projectId,
  itemId,
  related,
  ticketDocumentKinds,
  canEdit,
}: {
  projectId: string;
  itemId: string;
  related: Related[];
  ticketDocumentKinds: GetItem200["ticketDocumentKinds"];
  canEdit: boolean;
}) => {
  const queryClient = useQueryClient();
  const unlink = useUnlinkDocument({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getGetItemQueryKey(itemId) }),
      onError: (err) => toast.error(err.message),
    },
  });
  const own = related.filter((document) => document.from === null);
  const inherited = related.filter((document) => document.from !== null);
  const parentKey = inherited[0]?.from;

  const row = (document: Related, removable: boolean) => {
    const key = documentKey(document.kind, document.number);
    return (
      <div
        key={document.id}
        className={cn(
          "flex items-center gap-3 border-b py-2 pr-2 pl-3.5 last:border-b-0 hover:bg-muted/50",
          document.archived && "text-muted-foreground",
        )}
      >
        <KindBadge kind={document.kind} />
        <Link
          href={`/p/${projectId}/docs/${document.id}`}
          className="min-w-0 flex-1 truncate rounded-sm outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {key && `${key} `}
          {document.title}
        </Link>
        {document.status && <StatusBadge status={document.status} />}
        {document.archived && (
          <span className="rounded-full border px-2 py-0.5 text-xs">
            Archived
          </span>
        )}
        {removable && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Unlink ${document.title}`}
            disabled={unlink.isPending}
            onClick={() =>
              unlink.mutate({ id: itemId, documentId: document.id })
            }
          >
            <X />
          </Button>
        )}
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="related">
      <div className="flex items-center justify-between gap-3">
        <h2 id="related" className="font-semibold">
          Related
        </h2>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {ticketDocumentKinds.map((kind) => (
              <NewTicketDocumentDialog
                key={kind}
                kind={kind}
                projectId={projectId}
                itemId={itemId}
              />
            ))}
          </div>
        )}
      </div>

      {related.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No specs or linked documents yet.
        </p>
      )}
      {DOCUMENT_KINDS.map((kind) => {
        const group = own.filter((document) => document.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind} className="overflow-hidden rounded-lg border bg-card">
            {group.map((document) =>
              row(document, canEdit && document.home === "project"),
            )}
          </div>
        );
      })}
      {inherited.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            From {parentKey}
          </h3>
          <div className="overflow-hidden rounded-lg border bg-card">
            {inherited.map((document) => row(document, false))}
          </div>
        </div>
      )}

      {canEdit && (
        <LinkDocumentPicker
          projectId={projectId}
          itemId={itemId}
          linkedIds={related.map((document) => document.id)}
        />
      )}
    </section>
  );
};
