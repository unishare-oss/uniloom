"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  Pencil,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  KindIcon,
  PRIORITIES,
  PriorityIcon,
  StateLozenge,
  kindLabel,
  priorityLabel,
  type Priority,
} from "@/components/items/item-meta";
import { Markdown } from "@/components/markdown/markdown";
import { Avatar, EmptyAvatar } from "@/components/user/avatar";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { successMessage } from "@/lib/api/fetcher";
import {
  getGetItemQueryKey,
  getListDeletedItemsQueryKey,
  getListItemsQueryKey,
  useAddBlocker,
  useAddChecklistEntry,
  useDeleteChecklistEntry,
  useDeleteItem,
  useGetItem,
  useListItems,
  useMoveItem,
  useRemoveBlocker,
  useReorderChecklist,
  useUpdateChecklistEntry,
  useUpdateItem,
  type getItemResponse,
} from "@/lib/api/generated/items/items";
import type {
  GetItem200,
  UpdateItemBody,
} from "@/lib/api/generated/uniloomAPI.schemas";
import { useListMembers } from "@/lib/api/generated/members/members";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import { useGetMe } from "@/lib/api/generated/users/users";
import { formatDate, timeAgo } from "@/lib/time";

const NO_PARENT = "none";
const UNASSIGNED = "unassigned";

/**
 * Who has the item. Owners and managers (`canAssignOthers`) pick anyone; a member sees
 * who has it, with Claim when it's free (and `canClaim`) and Unclaim when it's theirs. The
 * API enforces it.
 */
const AssigneeField = ({
  projectId,
  assigneeId,
  canAssignOthers,
  canClaim,
  onChange,
}: {
  projectId: string;
  assigneeId: string | null;
  canAssignOthers: boolean;
  canClaim: boolean;
  onChange: (assigneeId: string | null) => void;
}) => {
  const { data: members } = useListMembers(projectId, {
    query: { select: (r) => r.data },
  });
  const { data: me } = useGetMe({ query: { select: (r) => r.data } });
  const assignee = members?.find((member) => member.userId === assigneeId);

  if (canAssignOthers) {
    const options = [
      { value: UNASSIGNED, label: "Unassigned" },
      ...(members ?? []).map((member) => ({
        value: member.userId,
        label: member.name,
      })),
    ];
    return (
      <Select
        value={assigneeId ?? UNASSIGNED}
        onValueChange={(value) =>
          onChange(value === UNASSIGNED ? null : (value as string))
        }
        items={options}
      >
        <SelectTrigger
          aria-label="Assignee"
          className="w-full hover:bg-muted/50 focus-visible:bg-muted/50"
        >
          {assignee && (
            <Avatar name={assignee.name} image={assignee.image} size={20} />
          )}
          {assigneeId === null && <EmptyAvatar />}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {assignee && (
        <>
          <Avatar name={assignee.name} image={assignee.image} size={20} />
          <span className="min-w-0 truncate text-sm">{assignee.name}</span>
        </>
      )}
      {assigneeId === null && (
        <>
          <EmptyAvatar />
          <span className="text-sm text-muted-foreground">Unassigned</span>
        </>
      )}
      {me && canClaim && assigneeId === null && (
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => onChange(me.id)}
        >
          <UserPlus />
          Claim
        </Button>
      )}
      {me && assigneeId === me.id && (
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => onChange(null)}
        >
          <UserMinus />
          Unclaim
        </Button>
      )}
    </div>
  );
};

/** Rendered description; Edit opens Write / Preview with Save and Cancel. */
const Description = ({
  value,
  saving,
  onSave,
}: {
  value: string;
  saving: boolean;
  onSave: (description: string) => Promise<unknown>;
}) => {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <section
        aria-labelledby="description"
        className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="description" className="font-semibold">
            Description
          </h2>
          <Button variant="secondary" onClick={() => setDraft(value)}>
            <Pencil />
            Edit
          </Button>
        </div>
        {value.trim() ? (
          <Markdown>{value}</Markdown>
        ) : (
          <button
            type="button"
            onClick={() => setDraft("")}
            className="rounded-md border border-dashed p-4 text-left text-muted-foreground transition-colors duration-150 ease-out outline-none hover:border-ring/60 hover:bg-muted hover:text-foreground focus-visible:border-ring/60 focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Add a description: Markdown, tables, task lists and ```mermaid
            diagrams.
          </button>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="description"
      className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
    >
      <h2 id="description" className="font-semibold">
        Description
      </h2>
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent
          value="write"
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        >
          <Textarea
            aria-label="Description, in Markdown"
            rows={14}
            autoFocus
            className="font-mono text-[13px]"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </TabsContent>
        <TabsContent
          value="preview"
          className="min-h-40 rounded-md border p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        >
          {draft.trim() ? (
            <Markdown>{draft}</Markdown>
          ) : (
            <p className="text-muted-foreground">Nothing to preview.</p>
          )}
        </TabsContent>
      </Tabs>
      <div className="flex items-center justify-end gap-2">
        {draft !== value && (
          <span className="mr-auto text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
            Unsaved changes
          </span>
        )}
        <Button variant="outline" onClick={() => setDraft(null)}>
          Cancel
        </Button>
        <Button
          disabled={saving}
          onClick={() => void onSave(draft).then(() => setDraft(null))}
        >
          Save
        </Button>
      </div>
    </section>
  );
};

type Entry = GetItem200["checklist"][number];

/** One checklist entry: tick, edit inline, move, delete. */
const ChecklistRow = ({
  entry,
  first,
  last,
  busy,
  onUpdate,
  onToggle,
  onDelete,
  onMove,
}: {
  entry: Entry;
  first: boolean;
  last: boolean;
  busy: boolean;
  onUpdate: (data: { text: string }, onDone: () => void) => void;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (step: -1 | 1) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);
  const close = () => setEditing(false);
  const startEdit = () => {
    setText(entry.text);
    setEditing(true);
  };

  if (editing) {
    return (
      <li className="flex flex-col gap-2 border-b px-3.5 py-2.5 last:border-b-0">
        <Input
          aria-label="Entry text"
          autoFocus
          maxLength={500}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={busy || !text.trim()}
            onClick={() => onUpdate({ text }, close)}
          >
            Save
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 border-b px-3.5 py-2.5 last:border-b-0">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={`${entry.text}, done`}
          checked={entry.done}
          disabled={busy}
          onChange={onToggle}
          className="mt-1 size-4 shrink-0 accent-primary"
        />
        <div className="min-w-0 flex-1">
          <p
            className={
              entry.done
                ? "break-words text-muted-foreground line-through"
                : "break-words"
            }
          >
            {entry.text}
          </p>
          {entry.evidence && (
            <p className="break-words text-sm text-muted-foreground">
              {entry.evidence}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Move up"
            disabled={busy || first}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Move down"
            disabled={busy || last}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit"
            onClick={startEdit}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </li>
  );
};

/** The done-when checklist: its entries and an input to add one. */
const Checklist = ({
  itemId,
  entries,
  refresh,
  onError,
}: {
  itemId: string;
  entries: Entry[];
  refresh: () => Promise<unknown>;
  onError: (err: { message: string }) => void;
}) => {
  const [text, setText] = useState("");
  const queryClient = useQueryClient();
  const add = useAddChecklistEntry({
    mutation: { onSuccess: refresh, onError },
  });
  const update = useUpdateChecklistEntry({
    mutation: { onSuccess: refresh, onError },
  });
  const remove = useDeleteChecklistEntry({
    mutation: { onSuccess: refresh, onError },
  });
  const reorder = useReorderChecklist({
    mutation: { onSuccess: refresh, onError },
  });
  const busy =
    add.isPending || update.isPending || remove.isPending || reorder.isPending;

  const addEntry = () => {
    // The add stays pending until the refresh is done, so a repeated Enter can't add twice.
    if (add.isPending || !text.trim()) return;
    add.mutate(
      { id: itemId, data: { text } },
      { onSuccess: () => setText("") },
    );
  };
  const itemKey = getGetItemQueryKey(itemId);
  /** Shows `checklist` at once, before the save; returns the cache to restore on error. */
  const showChecklist = async (checklist: Entry[]) => {
    // Wait, or a cancelled refetch can roll the cache back over the new checklist.
    await queryClient.cancelQueries({ queryKey: itemKey });
    const previous = queryClient.getQueryData<getItemResponse>(itemKey);
    queryClient.setQueryData<getItemResponse>(
      itemKey,
      (old) => old && { ...old, data: { ...old.data, checklist } },
    );
    return previous;
  };
  /** Swaps the entry with its neighbour on screen at once, then saves the new order. */
  const move = async (index: number, step: -1 | 1) => {
    const moved = [...entries];
    [moved[index], moved[index + step]] = [moved[index + step], moved[index]];
    const previous = await showChecklist(
      moved.map((entry, i) => ({ ...entry, position: i })),
    );
    reorder.mutate(
      { id: itemId, data: { ids: moved.map((entry) => entry.id) } },
      { onError: () => queryClient.setQueryData(itemKey, previous) },
    );
  };
  /** Ticks or unticks the entry on screen at once, then saves it. */
  const toggle = async (entry: Entry) => {
    const done = !entry.done;
    const previous = await showChecklist(
      entries.map((row) => (row.id === entry.id ? { ...row, done } : row)),
    );
    update.mutate(
      { id: itemId, entryId: entry.id, data: { done } },
      { onError: () => queryClient.setQueryData(itemKey, previous) },
    );
  };

  return (
    <section aria-labelledby="checklist" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 id="checklist" className="font-semibold">
          Checklist
        </h2>
        {entries.length > 0 && (
          <span className="text-xs font-semibold text-muted-foreground">
            {entries.filter((entry) => entry.done).length}/{entries.length}
          </span>
        )}
      </div>
      {entries.length > 0 && (
        <ul className="overflow-hidden rounded-lg border bg-card">
          {entries.map((entry, index) => (
            <ChecklistRow
              key={entry.id}
              entry={entry}
              first={index === 0}
              last={index === entries.length - 1}
              busy={busy}
              onUpdate={(data, onDone) =>
                update.mutate(
                  { id: itemId, entryId: entry.id, data },
                  { onSuccess: onDone },
                )
              }
              onToggle={() => void toggle(entry)}
              onDelete={() => remove.mutate({ id: itemId, entryId: entry.id })}
              onMove={(step) => void move(index, step)}
            />
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          aria-label="New checklist entry"
          placeholder="Add a done-when entry"
          maxLength={500}
          value={text}
          readOnly={add.isPending}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addEntry();
          }}
        />
        <Button
          variant="secondary"
          disabled={add.isPending || !text.trim()}
          onClick={addEntry}
        >
          Add
        </Button>
      </div>
    </section>
  );
};

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
  const update = useUpdateItem({ mutation: { onSuccess: refresh, onError } });
  const move = useMoveItem({ mutation: { onSuccess: refresh, onError } });
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
