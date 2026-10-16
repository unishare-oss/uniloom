"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CommentComposer } from "@/components/comments/comment-composer";
import { CommentListSkeleton } from "@/components/comments/comment-list-skeleton";
import { CommentThread } from "@/components/comments/comment-thread";
import { CollapsibleSection } from "@/components/collapsible-section";
import {
  getListDocumentCommentsQueryKey,
  getListItemCommentsQueryKey,
  useCreateDocumentComment,
  useCreateItemComment,
  useDeleteComment,
  useListDocumentComments,
  useListItemComments,
  useUpdateComment,
} from "@/lib/api/generated/comments/comments";

/** The comments on a ticket or a document: count, composer, and the nested thread. */
export const CommentSection = ({
  target,
}: {
  target: { kind: "item" | "document"; id: string };
}) => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isItem = target.kind === "item";
  // Both hooks are called; `enabled` lets only the one for this target fetch.
  const itemComments = useListItemComments(target.id, {
    query: { select: (r) => r.data, enabled: isItem },
  });
  const documentComments = useListDocumentComments(target.id, {
    query: { select: (r) => r.data, enabled: !isItem },
  });
  const { data, isLoading, isError } = isItem ? itemComments : documentComments;
  const createOnItem = useCreateItemComment();
  const createOnDocument = useCreateDocumentComment();
  const create = isItem ? createOnItem : createOnDocument;
  const update = useUpdateComment();
  const remove = useDeleteComment();

  const comments = data?.comments ?? [];
  const count = data?.count ?? 0;

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: isItem
        ? getListItemCommentsQueryKey(target.id)
        : getListDocumentCommentsQueryKey(target.id),
    });

  const fail = (err: unknown) => {
    setError(err instanceof Error ? err.message : "Something went wrong");
    return false;
  };

  const post = async (body: string, parentId?: string) => {
    setError(null);
    try {
      const input = { id: target.id, data: { body, parentId } };
      if (isItem) await createOnItem.mutateAsync(input);
      else await createOnDocument.mutateAsync(input);
      if (parentId) setReplyingId(null);
      await refresh();
      return true;
    } catch (err) {
      return fail(err);
    }
  };

  const save = async (id: string, body: string) => {
    setError(null);
    try {
      await update.mutateAsync({ id, data: { body } });
      setEditingId(null);
      await refresh();
      return true;
    } catch (err) {
      return fail(err);
    }
  };

  const del = async (id: string) => {
    setError(null);
    try {
      await remove.mutateAsync({ id });
      if (editingId === id) setEditingId(null);
      if (replyingId === id) setReplyingId(null);
      await refresh();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <CollapsibleSection id="comments" title="Comments" count={count}>
      <div className="mt-3 mb-6">
        <CommentComposer
          isPending={create.isPending && replyingId === null}
          onSubmit={(body) => post(body)}
        />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex flex-col">
        {isLoading && <CommentListSkeleton />}
        {comments.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            depth={0}
            editingId={editingId}
            replyingId={replyingId}
            isSaving={update.isPending}
            isReplying={create.isPending && replyingId !== null}
            onStartEdit={(id) => {
              setError(null);
              setReplyingId(null);
              setEditingId(id);
            }}
            onStartReply={(id) => {
              setError(null);
              setEditingId(null);
              setReplyingId(id);
            }}
            onCancel={() => {
              setError(null);
              setEditingId(null);
              setReplyingId(null);
            }}
            onSave={save}
            onReply={(id, body) => post(body, id)}
            onDelete={(id) => void del(id)}
          />
        ))}
        {isError && (
          <p className="py-4 text-sm text-destructive">
            Comments could not be loaded. Reload the page to try again.
          </p>
        )}
        {!isLoading && !isError && comments.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            No comments yet. Be the first to comment.
          </p>
        )}
      </div>
    </CollapsibleSection>
  );
};
