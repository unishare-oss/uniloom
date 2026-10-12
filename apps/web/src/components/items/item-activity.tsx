"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { ActivityRow } from "@/components/items/activity-row";
import type { StateCategory } from "@/components/items/item-meta";
import { useListItemActivity } from "@/lib/api/generated/items/items";

/** How many rows show before "Show older"; the API sends the latest 50. */
const SHOWN = 7;

/** The item's history, newest first: what changed, who changed it (or their agent), when. */
export const ItemActivity = ({
  itemId,
  itemKey,
  states,
}: {
  itemId: string;
  itemKey: string;
  states: { name: string; key: string | null; category: StateCategory }[];
}) => {
  const { data: rows = [] } = useListItemActivity(itemId, {
    query: { select: (r) => r.data },
  });
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, SHOWN);

  return (
    <details open className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-90" />
        <h2 id="activity" className="font-semibold">
          Activity
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {rows.length}
        </span>
      </summary>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <>
          {/* A timeline: the line runs behind the avatars, from the first entry to the last. */}
          <div className="relative mt-3 flex flex-col before:absolute before:top-5 before:bottom-5 before:left-[13.5px] before:w-px before:bg-primary">
            {shown.map((row) => (
              <ActivityRow
                key={row.id}
                row={row}
                itemKey={itemKey}
                states={states}
              />
            ))}
          </div>
          {!all && rows.length > SHOWN && (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="mt-1 ml-10 rounded-sm text-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Show older
            </button>
          )}
        </>
      )}
    </details>
  );
};
