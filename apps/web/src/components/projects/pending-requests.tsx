"use client";

import { useEffect, useId, useRef } from "react";
import { PendingRequestRow } from "@/components/projects/pending-request-row";
import { useListMyJoinRequests } from "@/lib/api/generated/invites/invites";

/**
 * The projects the person asked to join through an invite link and still waits for.
 * Nobody emails them the answer, so this is where they see it. Hidden when empty.
 */
export const PendingRequests = ({
  onEmptied,
}: {
  /** The last request is gone: the page moves keyboard focus somewhere that still exists. */
  onEmptied: () => void;
}) => {
  const headingId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  // The row that was just canceled: focus goes to the row that took its place.
  const canceledIndex = useRef<number | null>(null);
  const { data: requests } = useListMyJoinRequests({
    query: { select: (r) => r.data },
  });

  useEffect(() => {
    if (canceledIndex.current === null || !requests) return;
    const index = canceledIndex.current;
    canceledIndex.current = null;
    if (requests.length === 0) return onEmptied();
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(
      "[data-cancel-request]",
    );
    buttons?.[Math.min(index, buttons.length - 1)]?.focus();
  }, [requests, onEmptied]);

  if (!requests || requests.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-xl font-semibold tracking-tight">
          Waiting for approval
        </h2>
        <p className="text-muted-foreground">
          You asked to join these projects. An owner or manager of each one lets
          you in.
        </p>
      </div>
      <ul ref={listRef} className="divide-y rounded-xl border bg-card">
        {requests.map((request, index) => (
          <PendingRequestRow
            key={request.id}
            request={request}
            onCanceled={() => {
              canceledIndex.current = index;
            }}
          />
        ))}
      </ul>
    </section>
  );
};
