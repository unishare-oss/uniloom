"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { KindIcon } from "@/components/items/kind-icon";
import {
  PRIORITIES,
  kindLabel,
  priorityLabel,
  type Priority,
} from "@/components/items/item-meta";
import { PriorityIcon } from "@/components/items/priority-icon";
import { StateLozenge } from "@/components/items/state-lozenge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { successMessage } from "@/lib/api/fetcher";
import {
  getGetItemQueryKey,
  getListDeletedItemsQueryKey,
  getListItemsQueryKey,
  useAddBlocker,
  useDeleteItem,
  useGetItem,
  useListItems,
  useMoveItem,
  useRemoveBlocker,
  useUpdateItem,
  type getItemResponse,
} from "@/lib/api/generated/items/items";
import type {
  GetItem200,
  UpdateItemBody,
} from "@/lib/api/generated/uniloomAPI.schemas";
import { getGetReviewsQueryKey } from "@/lib/api/generated/reviews/reviews";
import { getGetNotificationsQueryKey } from "@/lib/api/generated/notifications/notifications";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import { formatDate, timeAgo } from "@/lib/time";
import { LabelPicker } from "@/components/items/label-picker";
import { AssigneeField } from "@/components/items/assignee-field";
import { Description } from "@/components/items/description";
import { Checklist } from "@/components/items/checklist";

const NO_PARENT = "none";

/** One item: its fields, what it waits on, and delete. */
export const ItemDetail = ({
  projectId,
  itemId,
}: {
  projectId: string;
  itemId: string;
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: item, error } = useGetItem(itemId, {
    query: { select: (r) => r.data, retry: false },
  });
  const { data: project, error: projectError } = useGetProject(projectId, {
    query: { select: (r) => r.data },
  });
  const { data: items, error: itemsError } = useListItems(projectId, {
    query: { select: (r) => r.data },
  });
  // An item opened under another project's URL (the API already checked you may see
  // it): go to its own project, so its states, parents and sidebar match.
  const elsewhere = item && item.projectId !== projectId;
  useEffect(() => {
    if (item && elsewhere)
      router.replace(`/p/${item.projectId}/items/${item.id}`);
  }, [item, elsewhere, router]);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetItemQueryKey(itemId) }),
      queryClient.invalidateQueries({
        queryKey: getListItemsQueryKey(projectId),
      }),
    ]);
  const onError = (err: { message: string }) => toast.error(err.message);
  // One scope per item: field saves run one at a time in click order, so a quick second
  // label click can't reach the API before the first. Only the last queued save
  // refetches, or the reload would flash the older value over the newer optimistic one.
  const saves = { id: `item-${itemId}` };
  const update = useUpdateItem({
    mutation: {
      scope: saves,
      onSuccess: () => {
        const queued = queryClient.isMutating({
          predicate: (mutation) => mutation.options.scope?.id === saves.id,
        });
        if (queued === 1) return refresh();
      },
      onError,
    },
  });
  const move = useMoveItem({
    mutation: {
      onSuccess: async () => {
        await Promise.all([
          refresh(),
          queryClient.invalidateQueries({ queryKey: getGetReviewsQueryKey() }),
          queryClient.invalidateQueries({
            queryKey: getGetNotificationsQueryKey(),
          }),
        ]);
      },
      onError,
    },
  });
  const addBlocker = useAddBlocker({
    mutation: {
      onSuccess: refresh,
      onError,
    },
  });
  const removeBlocker = useRemoveBlocker({
    mutation: { onSuccess: refresh, onError },
  });
  const remove = useDeleteItem({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await queryClient.invalidateQueries({
          queryKey: getListItemsQueryKey(projectId),
        });
        void queryClient.invalidateQueries({
          queryKey: getListDeletedItemsQueryKey(projectId),
        });
        router.push(`/p/${projectId}`);
      },
      onError,
    },
  });

  // Any of the three failing is an error, never an endless skeleton.
  const loadError = error ?? projectError ?? itemsError;
  if (loadError && !elsewhere) {
    return (
      <main className="flex flex-col items-start gap-3 px-6 py-12">
        <p role="alert">{loadError.message}</p>
        <Link
          href={`/p/${projectId}`}
          className="text-primary underline underline-offset-4"
        >
          Back to the board
        </Link>
      </main>
    );
  }
  if (!item || !project || !items || elsewhere) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  const save = (data: UpdateItemBody) =>
    update.mutateAsync({ id: item.id, data });
  // The pickers show the new value at once (`shown`), then save; a refusal puts the
  // old value back and the toast says why.
  const saveNow = async (data: UpdateItemBody, shown: Partial<GetItem200>) => {
    const itemKey = getGetItemQueryKey(item.id);
    // Wait, or a cancelled refetch can roll the cache back over the new value.
    await queryClient.cancelQueries({ queryKey: itemKey });
    const previous = queryClient.getQueryData<getItemResponse>(itemKey);
    queryClient.setQueryData<getItemResponse>(
      itemKey,
      (old) => old && { ...old, data: { ...old.data, ...shown } },
    );
    update.mutate(
      { id: item.id, data },
      { onError: () => queryClient.setQueryData(itemKey, previous) },
    );
  };
  // Moving has its own endpoint; the picker shows the new state at once, a refusal
  // puts the old one back.
  const moveNow = async (stateId: string, shown: Partial<GetItem200>) => {
    const itemKey = getGetItemQueryKey(item.id);
    await queryClient.cancelQueries({ queryKey: itemKey });
    const previous = queryClient.getQueryData<getItemResponse>(itemKey);
    queryClient.setQueryData<getItemResponse>(
      itemKey,
      (old) => old && { ...old, data: { ...old.data, ...shown } },
    );
    move.mutate(
      { id: item.id, data: { stateId } },
      { onError: () => queryClient.setQueryData(itemKey, previous) },
    );
  };
  const byId = new Map(items.map((row) => [row.id, row]));
  const states = project.states;
  const category = (stateId: string) =>
    states.find((s) => s.id === stateId)?.category;
  const parents = [
    { value: NO_PARENT, label: "No parent" },
    ...items
      .filter((row) => row.id !== item.id)
      .map((row) => ({ value: row.id, label: `${row.key} · ${row.title}` })),
  ];
  const children = items.filter((row) => row.parentId === item.id);
  // Every other item it doesn't already wait on; the API still refuses loops.
  const blockerOptions = items
    .filter((row) => row.id !== item.id && !item.blockedBy.includes(row.id))
    .map((row) => ({ value: row.id, label: `${row.key} · ${row.title}` }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-7">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
      >
        <Link
          href={`/p/${projectId}`}
          className="flex items-center gap-1.5 rounded-sm transition-colors duration-150 ease-out outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" />
          Board
        </Link>
        <span aria-hidden>/</span>
        <span className="min-w-0 truncate font-mono text-foreground">
          {item.key}
        </span>
      </nav>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title" className="text-xs text-muted-foreground">
              Title
            </Label>
            <Input
              id="title"
              key={item.title}
              defaultValue={item.title}
              maxLength={200}
              className="h-12 text-xl font-semibold hover:border-ring/60 md:text-xl"
              onBlur={(event) => {
                const title = event.target.value.trim();
                if (title && title !== item.title) void save({ title });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </div>

          <Description
            value={item.description}
            saving={update.isPending}
            onSave={(description) => save({ description })}
          />

          <Checklist
            itemId={item.id}
            entries={item.checklist}
            refresh={refresh}
            onError={onError}
          />

          {children.length > 0 && (
            <details open className="group">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-90" />
                <h2 id="children" className="font-semibold">
                  {item.kind === "FEATURE" ? "Slices" : "Subtasks"}
                </h2>
                <span className="text-xs font-semibold text-muted-foreground">
                  {children.length}
                </span>
              </summary>
              <div className="mt-3 overflow-hidden rounded-lg border bg-card">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/p/${projectId}/items/${child.id}`}
                    className="flex items-center gap-3 border-b px-3.5 py-2.5 transition-colors duration-150 ease-out outline-none last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    <KindIcon kind={child.kind} />
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {child.key}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {child.title}
                    </span>
                    <StateLozenge
                      name={child.state.name}
                      category={category(child.state.id)}
                    />
                  </Link>
                ))}
              </div>
            </details>
          )}

          <details open className="group">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-90" />
              <h2 id="blocked-by" className="font-semibold">
                Blocked by
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {item.blockedBy.length}
              </span>
            </summary>
            <div className="mt-3 rounded-lg border bg-card">
              {item.blockedBy.map((blockerId) => {
                const blocker = byId.get(blockerId);
                return (
                  <div
                    key={blockerId}
                    className="flex items-center gap-3 border-b py-2 pr-2 pl-3.5 transition-colors duration-150 ease-out hover:bg-muted/50 focus-within:bg-muted/50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
                  >
                    {blocker && <KindIcon kind={blocker.kind} />}
                    <Link
                      href={`/p/${projectId}/items/${blockerId}`}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                        {blocker?.key}
                      </span>
                      <span className="truncate">{blocker?.title}</span>
                    </Link>
                    {blocker && (
                      <StateLozenge
                        name={blocker.state.name}
                        category={category(blocker.state.id)}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground focus-visible:text-foreground"
                      aria-label={`Stop waiting on ${blocker?.key ?? "this item"}`}
                      disabled={removeBlocker.isPending}
                      onClick={() =>
                        removeBlocker.mutate({ id: item.id, blockerId })
                      }
                    >
                      <X />
                    </Button>
                  </div>
                );
              })}
              <div className="p-2.5">
                <Select
                  value={null}
                  onValueChange={(blockerId) => {
                    if (blockerId)
                      addBlocker.mutate({
                        id: item.id,
                        data: { blockerId: blockerId as string },
                      });
                  }}
                  items={blockerOptions}
                  disabled={!blockerOptions.length || addBlocker.isPending}
                >
                  <SelectTrigger
                    aria-label="Item this one waits on"
                    className="h-9 w-full"
                  >
                    <SelectValue
                      placeholder={
                        blockerOptions.length
                          ? "Wait on another item"
                          : "No other items to wait on"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {blockerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </details>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
              <Label className="text-sm text-muted-foreground">State</Label>
              <Select
                value={item.state.id}
                onValueChange={(stateId) => {
                  const state = states.find((s) => s.id === stateId);
                  if (!state) return;
                  const { id, name, key, category } = state;
                  void moveNow(id, { state: { id, name, key, category } });
                }}
                items={states.map((s) => ({ value: s.id, label: s.name }))}
                disabled={!item.canMove}
              >
                <SelectTrigger
                  aria-label="State"
                  className="-ml-2 w-fit max-w-full border-0 bg-transparent px-2 shadow-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:bg-muted"
                >
                  <StateLozenge
                    name={item.state.name}
                    category={item.state.category}
                  />
                </SelectTrigger>
                <SelectContent>
                  {states
                    .filter(
                      (s) =>
                        project.canMoveToDone ||
                        s.category !== "DONE" ||
                        s.id === item.state.id,
                    )
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Label className="text-sm text-muted-foreground">Priority</Label>
              <Select
                value={item.priority}
                onValueChange={(priority) =>
                  void saveNow(
                    { priority: priority as Priority },
                    { priority: priority as Priority },
                  )
                }
                items={PRIORITIES.map((p) => ({
                  value: p,
                  label: priorityLabel(p),
                }))}
              >
                <SelectTrigger
                  aria-label="Priority"
                  className="w-full hover:bg-muted/50 focus-visible:bg-muted/50"
                >
                  <PriorityIcon priority={item.priority} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {priorityLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label className="text-sm text-muted-foreground">Assignee</Label>
              <AssigneeField
                projectId={projectId}
                assigneeId={item.assigneeId}
                canAssignOthers={project.canAssignOthers}
                canClaim={project.canClaim}
                onChange={(assigneeId) =>
                  void saveNow({ assigneeId }, { assigneeId })
                }
              />

              <Label className="text-sm text-muted-foreground">Labels</Label>
              <LabelPicker
                projectId={projectId}
                labels={item.labels}
                onChange={(labels) =>
                  void saveNow(
                    { labelIds: labels.map((l) => l.id) },
                    { labels },
                  )
                }
              />

              <Label className="text-sm text-muted-foreground">Parent</Label>
              <Select
                value={item.parentId ?? NO_PARENT}
                onValueChange={(value) => {
                  const parentId =
                    value === NO_PARENT ? null : (value as string);
                  void saveNow({ parentId }, { parentId });
                }}
                items={parents}
              >
                <SelectTrigger
                  aria-label="Parent"
                  className="w-full hover:bg-muted/50 focus-visible:bg-muted/50"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {parents.map((parent) => (
                    <SelectItem key={parent.value} value={parent.value}>
                      {parent.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 border-t pt-4 text-sm">
              <dt className="text-muted-foreground">Kind</dt>
              <dd className="flex min-w-0 items-center gap-1.5">
                <KindIcon kind={item.kind} />
                {kindLabel(item.kind)}
              </dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDate(item.createdAt)}</dd>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{timeAgo(item.updatedAt)}</dd>
            </dl>
          </div>

          {project.canCreateItems && (
            <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Deleting moves it to the trash. You can restore it from there.
              </p>
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="destructive">Delete item</Button>}
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {item.key}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      It moves to the trash, and you can restore it from there.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ id: item.id })}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
};
