"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { BoardColumn } from "@/components/board/board-column";
import { CardFace, ItemCard } from "@/components/board/item-card";
import { StateLozenge } from "@/components/items/item-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGetItemQueryKey,
  getListItemsQueryKey,
  useListItems,
  useUpdateItem,
  type listItemsResponse,
} from "@/lib/api/generated/items/items";
import type {
  GetProject200StatesItem,
  ListItems200Item,
} from "@/lib/api/generated/uniloomAPI.schemas";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import { NewItemDialog } from "@/components/items/new-item-dialog";

type Row = ListItems200Item;
type State = GetProject200StatesItem;

// Space picks a card up and drops it; Enter still opens the card's link.
const keyboardCodes = {
  start: ["Space"],
  cancel: ["Escape"],
  end: ["Space"],
};

/**
 * The project's states as columns. Dragging a card to another column moves it at once
 * and saves; if the API refuses, the card goes back and a toast says why.
 */
export const Board = ({ projectId }: { projectId: string }) => {
  const queryClient = useQueryClient();
  const { data: project, error } = useGetProject(projectId, {
    query: { select: (r) => r.data, retry: false },
  });
  const { data: items, error: itemsError } = useListItems(projectId, {
    query: { select: (r) => r.data },
  });
  const updateItem = useUpdateItem();
  const [search, setSearch] = useState("");
  const [dragged, setDragged] = useState<Row | null>(null);
  // A drag ends with a click on the card; this keeps it from opening the item.
  const justDragged = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold on touch screens, so swiping still scrolls the board.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { keyboardCodes }),
  );

  // Either list failing is an error, never an empty board.
  const loadError = error ?? itemsError;
  if (loadError) {
    return (
      <main className="flex flex-col items-start gap-3 px-6 py-12">
        <p role="alert">{loadError.message}</p>
        <Link href="/" className="text-primary underline underline-offset-4">
          Back to your projects
        </Link>
      </main>
    );
  }

  // Columns appear once both the states and the items are in.
  const states = project && items ? project.states : [];
  const stateName = (id: string | number | undefined) =>
    states.find((s) => s.id === id)?.name ?? "";
  const query = search.trim().toLowerCase();
  const shown = (items ?? []).filter(
    (item) =>
      !query ||
      item.key.toLowerCase().includes(query) ||
      item.title.toLowerCase().includes(query),
  );
  const listKey = getListItemsQueryKey(projectId);

  const moveItem = async (item: Row, state: State) => {
    if (item.state.id === state.id) return;
    // Wait, or a cancelled refetch can roll the cache back over the move.
    await queryClient.cancelQueries({ queryKey: listKey });
    const previous = queryClient.getQueryData<listItemsResponse>(listKey);
    queryClient.setQueryData<listItemsResponse>(
      listKey,
      (old) =>
        old && {
          ...old,
          data: old.data.map((row) =>
            row.id === item.id
              ? { ...row, state: { id: state.id, name: state.name } }
              : row,
          ),
        },
    );
    updateItem.mutate(
      { id: item.id, data: { stateId: state.id } },
      {
        onError: (err) => {
          queryClient.setQueryData(listKey, previous);
          toast.error(err.message);
        },
        onSettled: () => {
          void queryClient.invalidateQueries({ queryKey: listKey });
          void queryClient.invalidateQueries({
            queryKey: getGetItemQueryKey(item.id),
          });
        },
      },
    );
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragged(null);
    setTimeout(() => (justDragged.current = false));
    const item = (active.data.current as { item: Row }).item;
    const state = states.find((s) => s.id === over?.id);
    if (state) void moveItem(item, state);
  };

  const keyOf = (id: string | number) =>
    items?.find((item) => item.id === id)?.key ?? "the card";

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${keyOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${keyOf(active.id)} is over ${stateName(over.id)}.`
        : `${keyOf(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${keyOf(active.id)} moved to ${stateName(over.id)}.`
        : `${keyOf(active.id)} was dropped back.`,
    onDragCancel: ({ active }) => `Moving ${keyOf(active.id)} was cancelled.`,
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-dots">
      <div className="flex flex-col gap-1 px-6 pt-5">
        <nav
          aria-label="Breadcrumb"
          className="flex gap-1.5 text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground">
            Projects
          </Link>
          <span>/</span>
          <span>{project?.name ?? "…"}</span>
        </nav>
        <h1 className="text-2xl font-medium tracking-tight">Board</h1>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex items-center">
            <span className="sr-only">Search this board</span>
            <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search this board"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-56 bg-card pl-8 dark:bg-card"
            />
          </label>
          {project && (
            <StateLozenge
              name={project.mode === "GUIDED" ? "Guided" : "Standard"}
            />
          )}
        </div>
        {project && items && (
          <NewItemDialog
            project={project}
            items={items}
            trigger={
              <Button className="h-9 px-3">
                <Plus />
                New item
              </Button>
            }
          />
        )}
      </div>

      <DndContext
        sensors={sensors}
        accessibility={{ announcements }}
        onDragStart={({ active }) => {
          justDragged.current = true;
          setDragged((active.data.current as { item: Row }).item);
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragged(null);
          setTimeout(() => (justDragged.current = false));
        }}
      >
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-6 pb-6 sm:snap-none">
          {(!project || !items) &&
            [0, 1, 2, 3].map((n) => (
              <Skeleton
                key={n}
                className="h-[60svh] w-[85vw] shrink-0 rounded-md sm:w-[270px]"
              />
            ))}
          {states.map((state) => {
            const cards = shown.filter((item) => item.state.id === state.id);
            return (
              <BoardColumn key={state.id} state={state} count={cards.length}>
                {cards.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    href={`/p/${projectId}/items/${item.id}`}
                    done={state.category === "DONE"}
                    onClick={(event) => {
                      if (justDragged.current) event.preventDefault();
                    }}
                  />
                ))}
              </BoardColumn>
            );
          })}
        </div>

        <DragOverlay>
          {dragged && (
            <div className="flex w-[252px] -rotate-2 cursor-grabbing flex-col gap-3 rounded-[4px] bg-card p-3 shadow-lifted">
              <CardFace item={dragged} done={false} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </main>
  );
};
