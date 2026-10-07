"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox, RefreshCw } from "lucide-react";
import { useState } from "react";
import { NotificationGroup } from "@/components/reviews/notification-group";
import { ReviewTask } from "@/components/reviews/review-task";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetReviews } from "@/lib/api/generated/reviews/reviews";
import {
  getGetNotificationsQueryKey,
  useGetNotifications,
  type getNotificationsResponse,
} from "@/lib/api/generated/notifications/notifications";
import type { GetNotifications200GroupsItem } from "@/lib/api/generated/uniloomAPI.schemas";
import { cn } from "@/lib/utils";

export const ReviewInbox = () => {
  const client = useQueryClient();
  const [view, setView] = useState<"review" | "notifications">("review");
  const [projectId, setProjectId] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [retained, setRetained] = useState<GetNotifications200GroupsItem[]>([]);
  const project = projectId === "all" ? undefined : projectId;
  const reviews = useGetReviews(
    {
      projectId: project,
      limit: 25,
      cursor: view === "review" ? cursors.at(-1) : undefined,
    },
    {
      query: { select: (response) => response.data, retry: false },
    },
  );
  const notifications = useGetNotifications(
    {
      projectId: project,
      limit: 25,
      cursor: view === "notifications" ? cursors.at(-1) : undefined,
      unreadOnly: view === "notifications" && unreadOnly ? "true" : "false",
    },
    {
      query: { select: (response) => response.data, retry: false },
    },
  );
  const query = view === "review" ? reviews : notifications;
  const projects = query.isError ? [] : (query.data?.projects ?? []);
  const currentGroups = notifications.isError
    ? []
    : (notifications.data?.groups ?? []);
  // Keep an opened group visible when its observed submissions become read.
  // The server's current project list still controls whether retained content is eligible.
  const groups = [
    ...currentGroups,
    ...retained.filter(
      (group) =>
        !notifications.isError &&
        projects.some((project) => project.id === group.item.project.id) &&
        !currentGroups.some((current) => current.item.id === group.item.id),
    ),
  ];
  const unreadCount = notifications.isError
    ? 0
    : (notifications.data?.unreadCount ?? 0);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Review inbox</h1>
        <Button
          variant="outline"
          className="h-10 rounded-xl"
          disabled={reviews.isFetching || notifications.isFetching}
          onClick={() => {
            setRetained([]);
            void reviews.refetch();
            void notifications.refetch();
            void client.invalidateQueries({
              predicate: (query) =>
                typeof query.queryKey[0] === "string" &&
                query.queryKey[0].startsWith("/api/notifications/items/"),
            });
          }}
        >
          <RefreshCw />
          Refresh
        </Button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <nav
          aria-label="Inbox views"
          className="flex gap-1 rounded-xl bg-muted p-1"
        >
          <Button
            aria-pressed={view === "review"}
            variant="ghost"
            className={cn(
              "h-10 rounded-lg px-2 text-xs sm:px-4 sm:text-sm",
              view === "review" && "bg-card shadow-sm",
            )}
            onClick={() => {
              setView("review");
              setCursors([undefined]);
              setRetained([]);
            }}
          >
            <Inbox className="hidden sm:block" />
            Needs review
          </Button>
          <Button
            aria-pressed={view === "notifications"}
            variant="ghost"
            className={cn(
              "h-10 rounded-lg px-2 text-xs sm:px-4 sm:text-sm",
              view === "notifications" && "bg-card shadow-sm",
            )}
            onClick={() => {
              setView("notifications");
              setCursors([undefined]);
              setRetained([]);
            }}
          >
            <Bell className="hidden sm:block" />
            Notifications
            {unreadCount > 0 && (
              <span
                className="rounded-md bg-primary px-1.5 py-0.5 text-xs text-primary-foreground tabular-nums"
                aria-label={`${unreadCount} unread notifications`}
              >
                {unreadCount}
              </span>
            )}
          </Button>
        </nav>
        <Select
          value={projectId}
          onValueChange={(value) => {
            setProjectId(value ?? "all");
            setCursors([undefined]);
            setRetained([]);
          }}
        >
          <SelectTrigger
            aria-label="Filter by project"
            className="h-10 min-w-40 rounded-xl"
          >
            <SelectValue>
              {projectId === "all"
                ? "All projects"
                : (projects.find((project) => project.id === projectId)?.name ??
                  "Selected project")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <section aria-labelledby="inbox-section-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="inbox-section-title" className="text-lg font-semibold">
            {view === "review" ? "Ready for your review" : "Submission history"}
          </h2>
          {view === "notifications" && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => {
                  setUnreadOnly(event.target.checked);
                  setCursors([undefined]);
                  setRetained([]);
                }}
                className="size-4 accent-primary"
              />
              Unread only
            </label>
          )}
        </div>
        {query.isPending ? (
          <p role="status" className="py-8 text-sm text-muted-foreground">
            Loading inbox…
          </p>
        ) : query.isError ? (
          <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
            <p>{query.error.message}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Retry inbox
            </Button>
            {projectId !== "all" && (
              <Button
                variant="ghost"
                onClick={() => {
                  setProjectId("all");
                  setCursors([undefined]);
                  setRetained([]);
                }}
              >
                Show all projects
              </Button>
            )}
          </div>
        ) : view === "review" ? (
          reviews.data?.items.length ? (
            <ul className="space-y-3">
              {reviews.data.items.map((item) => (
                <li key={item.id}>
                  <ReviewTask item={item} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border-2 border-dashed p-10 text-center">
              <CheckCheck className="mx-auto mb-3 size-7 text-muted-foreground" />
              <h3 className="font-semibold">Nothing waiting for review</h3>
            </div>
          )
        ) : groups.length ? (
          groups.map((group) => (
            <NotificationGroup
              key={group.item.id}
              group={group}
              onOpenChange={(open) =>
                setRetained((current) =>
                  open
                    ? [
                        ...current.filter(
                          (entry) => entry.item.id !== group.item.id,
                        ),
                        group,
                      ]
                    : current.filter(
                        (entry) => entry.item.id !== group.item.id,
                      ),
                )
              }
              onReadChange={(delta) => {
                setRetained((current) =>
                  current.map((entry) =>
                    entry.item.id === group.item.id
                      ? {
                          ...entry,
                          unreadCount: Math.max(0, entry.unreadCount - delta),
                        }
                      : entry,
                  ),
                );
                client.setQueriesData<getNotificationsResponse>(
                  {
                    queryKey: getGetNotificationsQueryKey(),
                    predicate: (query) => {
                      const params = query.queryKey[1] as
                        { projectId?: string } | undefined;
                      return (
                        !params?.projectId ||
                        params.projectId === group.item.project.id
                      );
                    },
                  },
                  (response) =>
                    response && {
                      ...response,
                      data: {
                        ...response.data,
                        unreadCount: Math.max(
                          0,
                          response.data.unreadCount -
                            (response.data.projects.some(
                              (project) => project.id === group.item.project.id,
                            )
                              ? delta
                              : 0),
                        ),
                        groups: response.data.groups.map((entry) =>
                          entry.item.id === group.item.id
                            ? {
                                ...entry,
                                unreadCount: Math.max(
                                  0,
                                  entry.unreadCount - delta,
                                ),
                              }
                            : entry,
                        ),
                      },
                    },
                );
              }}
            />
          ))
        ) : (
          <div className="rounded-xl border-2 border-dashed p-10 text-center">
            <CheckCheck className="mx-auto mb-3 size-7 text-muted-foreground" />
            <h3 className="font-semibold">
              {unreadOnly ? "No unread notifications" : "No notifications yet"}
            </h3>
          </div>
        )}
        {!query.isError && (
          <div className="flex flex-wrap gap-2">
            {cursors.length > 1 && (
              <Button
                variant="outline"
                disabled={query.isFetching}
                onClick={() => {
                  setCursors((current) => current.slice(0, -1));
                  setRetained([]);
                }}
              >
                Previous page
              </Button>
            )}
            {query.data?.nextCursor && (
              <Button
                variant="outline"
                disabled={query.isFetching}
                onClick={() => {
                  setCursors((current) => [
                    ...current,
                    query.data!.nextCursor!,
                  ]);
                  setRetained([]);
                }}
              >
                Next page
              </Button>
            )}
          </div>
        )}
      </section>
    </main>
  );
};
