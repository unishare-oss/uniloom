"use client";

import { ChevronDown, MessageSquareReply, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { CommentEditor } from "@/components/comments/comment-editor";
import { linkifyText } from "@/components/comments/linkify-text";
import { Avatar } from "@/components/user/avatar";
import { Button } from "@/components/ui/button";
import type { Comment } from "@/lib/api/generated/uniloomAPI.schemas";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Per depth below the top: the bar colour and the text colour that goes with it. */
const LAYERS = [
  { bar: "bg-primary", text: "text-primary" },
  { bar: "bg-chart-2", text: "text-chart-2" },
  { bar: "bg-chart-3", text: "text-chart-3" },
  { bar: "bg-muted-foreground", text: "text-muted-foreground" },
];

/** One comment and, below it, its replies. Calls itself for each reply. */
export const CommentThread = ({
  comment,
  depth,
  editingId,
  replyingId,
  isSaving,
  isReplying,
  onStartEdit,
  onStartReply,
  onCancel,
  onSave,
  onReply,
  onDelete,
}: {
  comment: Comment;
  depth: number;
  editingId: string | null;
  replyingId: string | null;
  isSaving: boolean;
  isReplying: boolean;
  onStartEdit: (id: string) => void;
  onStartReply: (id: string) => void;
  onCancel: () => void;
  onSave: (id: string, body: string) => Promise<boolean>;
  onReply: (id: string, body: string) => Promise<boolean>;
  onDelete: (id: string) => void;
}) => {
  const [open, setOpen] = useState(true);
  const layer = depth > 0 ? LAYERS[(depth - 1) % LAYERS.length] : null;
  const steps = Math.min(depth, 8);
  const name = comment.author?.name ?? "Deleted user";
  const hasReplies = comment.replies.length > 0;
  const subtle = layer?.text ?? "text-muted-foreground";

  return (
    <div
      className={cn(
        "py-4",
        depth === 0 && "border-b last:border-b-0",
        depth > 0 && "pb-0",
        depth >= 1 && "ml-4",
        steps >= 2 && "sm:ml-7",
        steps >= 3 && "lg:ml-10",
        steps >= 5 && "xl:ml-12",
      )}
    >
      <div className={cn(depth > 0 && "pt-1")}>
        <div className={cn("relative", depth > 0 && "pl-5")}>
          {layer && (
            <button
              type="button"
              aria-label={open ? "Collapse thread" : "Expand thread"}
              onClick={() => hasReplies && setOpen((o) => !o)}
              className={cn(
                "group/bar absolute top-0 bottom-0 left-0 flex w-4 items-start justify-start",
                hasReplies ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "h-full w-1.5 rounded-full transition-opacity duration-150",
                  layer.bar,
                  hasReplies && "group-hover/bar:opacity-50",
                )}
              />
            </button>
          )}

          <div className="mb-2 flex min-w-0 items-center gap-2.5">
            <Avatar
              name={name}
              image={comment.author?.image ?? null}
              size={26}
            />
            <span
              className={cn(
                "truncate text-sm font-medium",
                depth > 0 ? layer?.text : "text-foreground",
              )}
            >
              {name}
            </span>
            {comment.isTargetAuthor && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase">
                Author
              </span>
            )}
            <span className={cn("text-xs", subtle)}>
              {timeAgo(comment.createdAt)}
            </span>
            {comment.editedAt && !comment.deleted && (
              <span
                className={cn("text-[10px] tracking-wider uppercase", subtle)}
              >
                (edited)
              </span>
            )}
          </div>

          {editingId === comment.id ? (
            <div className="pl-9">
              <CommentEditor
                initialValue={comment.body}
                submitLabel="Save"
                pendingLabel="Saving..."
                isPending={isSaving}
                onSubmit={(body) => onSave(comment.id, body)}
                onCancel={onCancel}
              />
            </div>
          ) : (
            <>
              <p
                className={cn(
                  "pl-9 text-sm leading-relaxed break-words whitespace-pre-wrap",
                  comment.deleted
                    ? "text-muted-foreground italic"
                    : "text-foreground",
                )}
              >
                {comment.deleted
                  ? "This comment was deleted."
                  : linkifyText(comment.body)}
              </p>
              {!comment.deleted && (
                <div className="mt-2 flex flex-wrap items-center gap-1 pl-9">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onStartReply(comment.id)}
                    className="text-muted-foreground uppercase tracking-wider hover:bg-transparent hover:text-foreground"
                  >
                    <MessageSquareReply className="size-3.5" />
                    Reply
                  </Button>
                  {comment.canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onStartEdit(comment.id)}
                      aria-label="Edit comment"
                    >
                      <Pencil className="size-3.5 text-muted-foreground" />
                    </Button>
                  )}
                  {comment.canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onDelete(comment.id)}
                      aria-label="Delete comment"
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {replyingId === comment.id && !comment.deleted && (
            <div className="mt-3 pl-9">
              <CommentEditor
                placeholder={`Reply to ${name}...`}
                submitLabel="Reply"
                pendingLabel="Replying..."
                isPending={isReplying}
                onSubmit={(body) => onReply(comment.id, body)}
                onCancel={onCancel}
              />
            </div>
          )}

          {hasReplies && (
            <div className="mt-3 pl-9">
              <span className="inline-flex h-8 items-center">
                <ChevronDown
                  className={cn(
                    "mr-1 size-3 transition-transform",
                    !open && "-rotate-90",
                    subtle,
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setOpen((o) => !o)}
                  className="px-0 text-muted-foreground uppercase tracking-wider hover:bg-transparent hover:text-foreground"
                >
                  {open
                    ? "Hide replies"
                    : `Show replies (${comment.replies.length})`}
                </Button>
              </span>
            </div>
          )}
        </div>

        {hasReplies && open && (
          <div className="mt-2">
            {comment.replies.map((reply) => (
              <CommentThread
                key={reply.id}
                comment={reply}
                depth={depth + 1}
                editingId={editingId}
                replyingId={replyingId}
                isSaving={isSaving}
                isReplying={isReplying}
                onStartEdit={onStartEdit}
                onStartReply={onStartReply}
                onCancel={onCancel}
                onSave={onSave}
                onReply={onReply}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
