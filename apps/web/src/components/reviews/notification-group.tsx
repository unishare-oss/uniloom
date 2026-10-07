"use client";

import { CheckCheck, ChevronDown, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KindIcon } from "@/components/items/kind-icon";
import { StateLozenge } from "@/components/items/state-lozenge";
import { ReviewItemPreview } from "@/components/reviews/review-item-preview";
import { Button } from "@/components/ui/button";
import {
  getGetNotificationsQueryKey,
  getGetItemNotificationsQueryKey,
  useGetItemNotifications,
  usePostReadNotifications,
  usePostUnreadNotifications,
} from "@/lib/api/generated/notifications/notifications";
import type { GetNotifications200GroupsItem } from "@/lib/api/generated/uniloomAPI.schemas";

const timestamp = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export const NotificationGroup = ({
  group,
  onOpenChange,
  onReadChange,
}: {
  group: GetNotifications200GroupsItem;
  onOpenChange: (open: boolean) => void;
  onReadChange: (delta: number) => void;
}) => {
  const { item } = group;
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const attemptedIds = useRef(new Set<string>());
  const autoRead = useRef(true);
  const history = useGetItemNotifications(
    item.id,
    { limit: 25, cursor: cursors.at(-1) },
    {
      query: {
        enabled: open,
        select: (response) => response.data,
        retry: false,
      },
    },
  );
  const read = usePostReadNotifications({
    mutation: {
      onSuccess: () => {
        void client.invalidateQueries({
          queryKey: getGetNotificationsQueryKey(),
        });
        void client.invalidateQueries({
          queryKey: getGetItemNotificationsQueryKey(item.id),
        });
      },
      onError: (error, variables) => {
        setOverrides((current) =>
          Object.fromEntries(
            Object.entries(current).filter(
              ([id]) => !variables.data.ids.includes(id),
            ),
          ),
        );
        onReadChange(-variables.data.ids.length);
        toast.error(error.message);
        void client.invalidateQueries({
          queryKey: getGetNotificationsQueryKey(),
        });
      },
    },
  });
  const unread = usePostUnreadNotifications({
    mutation: {
      onSuccess: () => {
        void client.invalidateQueries({
          queryKey: getGetNotificationsQueryKey(),
        });
        void client.invalidateQueries({
          queryKey: getGetItemNotificationsQueryKey(item.id),
        });
      },
      onError: (error, variables) => {
        setOverrides((current) =>
          Object.fromEntries(
            Object.entries(current).filter(
              ([id]) => !variables.data.ids.includes(id),
            ),
          ),
        );
        onReadChange(variables.data.ids.length);
        toast.error(error.message);
        void client.invalidateQueries({
          queryKey: getGetNotificationsQueryKey(),
        });
      },
    },
  });
  const readIds =
    history.data?.items
      .filter((entry) => overrides[entry.id] ?? !!entry.readAt)
      .map((entry) => entry.id) ?? [];

  useEffect(() => {
    if (
      !open ||
      !autoRead.current ||
      history.isFetching ||
      history.isError ||
      !history.data ||
      read.isPending ||
      unread.isPending
    )
      return;
    const ids = history.data.items
      .filter((entry) => !entry.readAt && !attemptedIds.current.has(entry.id))
      .map((entry) => entry.id);
    if (!ids.length) return;
    ids.forEach((id) => attemptedIds.current.add(id));
    // Only the entries rendered on this history page are consumed.
    setOverrides((current) => ({
      ...current,
      ...Object.fromEntries(ids.map((id) => [id, true])),
    }));
    onReadChange(ids.length);
    read.mutate({ data: { ids } });
  }, [
    open,
    history.data,
    history.isFetching,
    history.isError,
    read,
    unread.isPending,
    onReadChange,
  ]);

  return (
    <details
      name="notification-task"
      className="group rounded-xl border bg-card open:border-primary/40"
      onToggle={(event) => {
        if (event.target !== event.currentTarget) return;
        const expanded = event.currentTarget.open;
        if (expanded) {
          autoRead.current = true;
          attemptedIds.current.clear();
          setOverrides({});
        }
        setOpen(expanded);
        onOpenChange(expanded);
      }}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:items-center sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="mt-1 flex size-5 shrink-0 items-center justify-center sm:mt-0">
          {group.unreadCount > 0 ? (
            <span
              className="size-2 rounded-full bg-primary"
              aria-label={`${group.unreadCount} unread notifications`}
            />
          ) : (
            <CheckCheck
              aria-label="All notifications read"
              className="size-4 text-muted-foreground"
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {item.kind && <KindIcon kind={item.kind} />}
            <span className="font-mono">{item.key}</span>
            <span>{item.project.name}</span>
          </div>
          <h3 className="mt-1.5 text-sm font-semibold leading-relaxed">
            {item.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {group.totalCount}{" "}
            {group.totalCount === 1 ? "submission" : "submissions"} · Latest{" "}
            <time dateTime={group.latestSubmittedAt}>
              {timestamp.format(new Date(group.latestSubmittedAt))}
            </time>
          </p>
        </div>
        {item.state && (
          <span className="shrink-0">
            <StateLozenge
              name={item.state.name}
              category={item.state.category}
            />
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-muted-foreground group-open:rotate-180"
        />
      </summary>
      {open && (
        <div className="space-y-4 border-t px-4 py-4 sm:px-5">
          {!history.isError && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-4 text-sm">
                {item.available && (
                  <Link
                    href={`/p/${item.project.id}/items/${item.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    Open task
                  </Link>
                )}
                <Link
                  href={`/p/${item.project.id}`}
                  className="text-muted-foreground underline underline-offset-4"
                >
                  Open project
                </Link>
              </div>
              <Button
                variant="outline"
                disabled={
                  !readIds.length ||
                  read.isPending ||
                  unread.isPending ||
                  history.isFetching
                }
                onClick={() => {
                  autoRead.current = false;
                  setOverrides((current) => ({
                    ...current,
                    ...Object.fromEntries(readIds.map((id) => [id, false])),
                  }));
                  onReadChange(-readIds.length);
                  unread.mutate({ data: { ids: readIds } });
                }}
              >
                <Mail />
                Mark as unread
              </Button>
            </div>
          )}
          {history.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Loading submissions…
            </p>
          ) : history.isError ? (
            <div role="alert" className="space-y-3 text-sm">
              <p>{history.error.message}</p>
              <Button variant="outline" onClick={() => void history.refetch()}>
                Retry history
              </Button>
            </div>
          ) : (
            <>
              {item.available && (
                <details
                  className="group/preview rounded-lg border"
                  onToggle={(event) => {
                    if (event.target === event.currentTarget)
                      setPreviewOpen(event.currentTarget.open);
                  }}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    Preview task
                    <ChevronDown
                      aria-hidden="true"
                      className="size-4 text-muted-foreground group-open/preview:rotate-180"
                    />
                  </summary>
                  {previewOpen && <ReviewItemPreview itemId={item.id} />}
                </details>
              )}
              {read.isError && (
                <Button
                  variant="outline"
                  disabled={read.isPending}
                  onClick={() => {
                    attemptedIds.current.clear();
                    read.reset();
                    void history.refetch();
                  }}
                >
                  Retry marking read
                </Button>
              )}
              <ol className="space-y-3">
                {history.data.items.map((entry) => {
                  const isRead = overrides[entry.id] ?? !!entry.readAt;
                  return (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-sm"
                    >
                      <div>
                        <span className="font-medium">
                          {entry.actor?.name ?? "Former member"}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          submitted for review
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <time dateTime={entry.submittedAt}>
                            {timestamp.format(new Date(entry.submittedAt))}
                          </time>
                        </p>
                      </div>
                      <span
                        className={
                          isRead
                            ? "text-xs text-muted-foreground"
                            : "text-xs font-semibold text-primary"
                        }
                      >
                        {isRead ? "Read" : "Unread"}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap gap-2">
                {cursors.length > 1 && (
                  <Button
                    variant="outline"
                    disabled={read.isPending || unread.isPending}
                    onClick={() =>
                      setCursors((current) => current.slice(0, -1))
                    }
                  >
                    Newer submissions
                  </Button>
                )}
                {history.data.nextCursor && (
                  <Button
                    variant="outline"
                    disabled={read.isPending || unread.isPending}
                    onClick={() =>
                      setCursors((current) => [
                        ...current,
                        history.data.nextCursor!,
                      ])
                    }
                  >
                    Older submissions
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </details>
  );
};
