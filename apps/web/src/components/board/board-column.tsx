"use client";

import { useDndContext, useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { stateTopClass } from "@/components/items/item-meta";
import type {
  GetProject200StatesItem,
  ListItems200Item,
} from "@/lib/api/generated/uniloomAPI.schemas";
import { cn } from "@/lib/utils";

/** One state's column; cards dropped on it move to that state. */
export const BoardColumn = ({
  state,
  children,
  count,
}: {
  state: GetProject200StatesItem;
  children: ReactNode;
  count: number;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: state.id });
  const { active } = useDndContext();
  const from = (active?.data.current as { item: ListItems200Item } | undefined)
    ?.item.state.id;
  const target = isOver && from !== state.id;
  return (
    <section
      ref={setNodeRef}
      aria-label={state.name}
      className={cn(
        "flex h-full w-[85vw] shrink-0 snap-start flex-col gap-1 rounded-md rounded-t-[4px] border-t-[3px] bg-column p-1.5 sm:w-[270px]",
        stateTopClass(state),
        target && "bg-accent ring-2 ring-primary ring-inset",
      )}
    >
      <h2 className="px-1.5 pt-1.5 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {state.name} <span className="font-normal">{count}</span>
      </h2>
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {children}
        {target && (
          <div className="h-[88px] shrink-0 rounded-[4px] border-2 border-dashed border-primary bg-card/60" />
        )}
      </div>
    </section>
  );
};
