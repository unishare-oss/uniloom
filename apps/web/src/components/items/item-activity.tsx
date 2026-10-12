"use client";

import { ChevronRight } from "lucide-react";
import { ActivityRow } from "@/components/items/activity-row";
import { useListItemActivity } from "@/lib/api/generated/items/items";

/** The item's history, newest first: what changed, who changed it (or their agent), when. */
export const ItemActivity = ({ itemId }: { itemId: string }) => {
  const { data: rows } = useListItemActivity(itemId, {
    query: { select: (r) => r.data },
  });

  return (
    <details open className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-90" />
        <h2 id="activity" className="font-semibold">
          Activity
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {rows?.length ?? 0}
        </span>
      </summary>
      <div className="mt-3 overflow-hidden rounded-lg border bg-card">
        {rows?.map((row) => (
          <ActivityRow key={row.id} row={row} />
        ))}
        {rows?.length === 0 && (
          <p className="px-3.5 py-2.5 text-sm text-muted-foreground">
            No activity yet.
          </p>
        )}
      </div>
    </details>
  );
};
