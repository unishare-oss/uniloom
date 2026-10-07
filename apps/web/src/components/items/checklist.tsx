"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getGetItemQueryKey,
  useAddChecklistEntry,
  useDeleteChecklistEntry,
  useReorderChecklist,
  useUpdateChecklistEntry,
  type getItemResponse,
} from "@/lib/api/generated/items/items";
import { ChecklistRow, type Entry } from "@/components/items/checklist-row";

/** The done-when checklist: its entries and an input to add one. */
export const Checklist = ({
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
