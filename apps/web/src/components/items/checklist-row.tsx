"use client";

import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GetItem200 } from "@/lib/api/generated/uniloomAPI.schemas";

export type Entry = GetItem200["checklist"][number];

/** One checklist entry: tick, edit inline, move, delete. */
export const ChecklistRow = ({
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
