"use client";

import { Check, Circle } from "lucide-react";
import { Markdown } from "@/components/markdown/markdown";
import { Button } from "@/components/ui/button";
import { useGetItem } from "@/lib/api/generated/items/items";

export const ReviewItemPreview = ({ itemId }: { itemId: string }) => {
  const query = useGetItem(itemId, {
    query: { select: (response) => response.data, retry: false },
  });
  if (query.isPending)
    return (
      <p role="status" className="border-t p-5 text-sm text-muted-foreground">
        Loading task…
      </p>
    );
  if (query.isError)
    return (
      <div role="alert" className="space-y-3 border-t p-5 text-sm">
        <p>{query.error.message}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry preview
        </Button>
      </div>
    );
  const item = query.data;
  return (
    <section
      aria-label={`Preview of ${item.key}`}
      className="space-y-5 border-t p-5 sm:p-6"
    >
      {item.description ? (
        <Markdown>{item.description}</Markdown>
      ) : (
        <p className="text-sm text-muted-foreground">No description.</p>
      )}
      {item.checklist.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Checklist</h3>
          <ul className="mt-3 space-y-3">
            {item.checklist.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 text-sm">
                {entry.done ? (
                  <Check
                    aria-label="Complete"
                    className="mt-0.5 size-4 shrink-0 text-done-foreground"
                  />
                ) : (
                  <Circle
                    aria-label="Incomplete"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                )}
                <div>
                  <p>{entry.text}</p>
                  {entry.evidence && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {entry.evidence}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
