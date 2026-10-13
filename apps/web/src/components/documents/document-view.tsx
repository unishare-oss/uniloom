"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ChevronRight, Pencil } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { KindBadge } from "@/components/documents/kind-badge";
import { Markdown } from "@/components/markdown/markdown";
import { Avatar } from "@/components/user/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { successMessage } from "@/lib/api/fetcher";
import {
  getGetDocumentQueryKey,
  getListDocumentsQueryKey,
  useGetDocument,
  useUpdateDocument,
} from "@/lib/api/generated/documents/documents";
import { formatDate, timeAgo } from "@/lib/time";

/** One document: Markdown on the left, who and when on the right, Edit and Archive. */
export const DocumentView = ({
  projectId,
  documentId,
}: {
  projectId: string;
  documentId: string;
}) => {
  const queryClient = useQueryClient();
  const { data: document, error } = useGetDocument(documentId, {
    query: { select: (r) => r.data, retry: false },
  });
  const update = useUpdateDocument({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getGetDocumentQueryKey(documentId),
          }),
          queryClient.invalidateQueries({
            queryKey: getListDocumentsQueryKey(projectId),
          }),
        ]);
      },
      onError: (err) => toast.error(err.message),
    },
  });
  const archived = !!document?.archivedAt;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-8">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href={`/p/${projectId}/docs`} className="hover:underline">
          Knowledge
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate text-foreground">
          {document?.title ?? "Document"}
        </span>
      </nav>

      {error && <p role="alert">{error.message}</p>}
      {!document && !error && <Skeleton className="h-96 w-full rounded-xl" />}

      {document && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col items-start gap-2">
              <KindBadge kind={document.kind} />
              <h1 className="text-2xl font-semibold tracking-tight">
                {document.title}
              </h1>
            </div>
            {document.canEdit && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  render={
                    <Link href={`/p/${projectId}/docs/${document.id}/edit`} />
                  }
                >
                  <Pencil />
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      id: document.id,
                      data: { archived: !archived },
                    })
                  }
                >
                  {archived ? <ArchiveRestore /> : <Archive />}
                  {archived ? "Restore" : "Archive"}
                </Button>
              </div>
            )}
          </div>

          {archived && (
            <p
              role="status"
              className="rounded-lg border bg-muted px-4 py-2.5 text-sm"
            >
              This document is archived. It stays readable but is hidden from
              the library unless Show archived is on.
            </p>
          )}

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <article>
              {document.body.trim() ? (
                <Markdown>{document.body}</Markdown>
              ) : (
                <p className="text-muted-foreground">This document is empty.</p>
              )}
            </article>
            <aside className="flex h-fit flex-col gap-4 rounded-xl border bg-card p-4 text-sm">
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground">
                  Purpose
                </h2>
                <p>{document.purpose || "No purpose written."}</p>
              </div>
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground">
                  Author
                </h2>
                {document.author ? (
                  <p className="mt-1 flex items-center gap-2">
                    <Avatar
                      name={document.author.name}
                      image={document.author.image}
                      size={24}
                    />
                    {document.author.name}
                  </p>
                ) : (
                  <p>Unknown</p>
                )}
              </div>
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground">
                  Last edited
                </h2>
                <p title={formatDate(document.updatedAt)}>
                  {timeAgo(document.updatedAt)}
                </p>
              </div>
              <p className="border-t pt-3 text-muted-foreground">
                {document.canEdit
                  ? "You can edit this because you are an owner or manager."
                  : "You can read this. Only owners and managers can edit it."}
              </p>
            </aside>
          </div>
        </>
      )}
    </main>
  );
};
