"use client";

import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import type { MouseEvent } from "react";
import { CardFace } from "@/components/board/card-face";
import type {
  ListItems200Item,
  ListMembers200Item,
} from "@/lib/api/generated/uniloomAPI.schemas";
import { cn } from "@/lib/utils";

/** A card on the board: a link to the item that can be dragged to another column. */
export const ItemCard = ({
  item,
  assignee,
  href,
  done,
  onClick,
}: {
  item: ListItems200Item;
  assignee?: ListMembers200Item;
  href: string;
  done: boolean;
  onClick: (event: MouseEvent) => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
    // The API says whether the caller may move it.
    disabled: !item.canMove,
  });
  return (
    <Link
      ref={setNodeRef}
      href={href}
      onClick={onClick}
      {...listeners}
      {...attributes}
      // Still a link to the item; dnd-kit's describedby explains how to drag it.
      role={undefined}
      className={cn(
        "flex touch-manipulation flex-col gap-3 rounded-[4px] bg-card p-3 shadow-card outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-40",
      )}
    >
      <CardFace item={item} assignee={assignee} done={done} />
    </Link>
  );
};
