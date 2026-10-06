"use client";

import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import type { MouseEvent } from "react";
import { KindIcon, PriorityIcon } from "@/components/items/item-meta";
import { Avatar, EmptyAvatar } from "@/components/user/avatar";
import type {
  ListItems200Item,
  ListMembers200Item,
} from "@/lib/api/generated/uniloomAPI.schemas";
import { cn } from "@/lib/utils";

/** The card's face, shared by the card on the board and the one being dragged. */
export const CardFace = ({
  item,
  assignee,
  done,
}: {
  item: ListItems200Item;
  /** The member who has it, if any. */
  assignee?: ListMembers200Item;
  done: boolean;
}) => {
  return (
    <>
      <span className="text-sm leading-snug">{item.title}</span>
      <div className="flex items-center gap-1.5">
        <KindIcon kind={item.kind} />
        <span
          className={cn(
            "text-xs font-semibold text-muted-foreground",
            done && "line-through",
          )}
        >
          {item.key}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <PriorityIcon priority={item.priority} />
          {assignee && (
            <span title={assignee.name}>
              <Avatar name={assignee.name} image={assignee.image} size={20} />
              <span className="sr-only">Assigned to {assignee.name}</span>
            </span>
          )}
          {item.assigneeId === null && (
            <span>
              <EmptyAvatar />
              <span className="sr-only">Unassigned</span>
            </span>
          )}
        </span>
      </div>
    </>
  );
};

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
