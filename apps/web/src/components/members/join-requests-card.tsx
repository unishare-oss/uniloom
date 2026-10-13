"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { JoinRequestRow } from "@/components/members/join-request-row";
import { successMessage } from "@/lib/api/fetcher";
import {
  getListJoinRequestsQueryKey,
  useApproveJoinRequest,
  useDeclineJoinRequest,
  useListJoinRequests,
} from "@/lib/api/generated/invites/invites";
import { getListMembersQueryKey } from "@/lib/api/generated/members/members";
import { getGetProjectQueryKey } from "@/lib/api/generated/projects/projects";

/**
 * The people who asked to join through an invite link that needs approval, for owners
 * and managers. Hidden while nobody waits.
 */
export const JoinRequestsCard = ({
  projectId,
  onEmptied,
}: {
  projectId: string;
  /** The last request was decided: the page moves keyboard focus somewhere that still exists. */
  onEmptied: () => void;
}) => {
  const queryClient = useQueryClient();
  const headingId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  // The row a decision was made on: once the list refreshes, focus goes to the row that
  // took its place, so a keyboard user can keep deciding.
  const decidedIndex = useRef<number | null>(null);
  const { data: requests } = useListJoinRequests(projectId, {
    query: { select: (r) => r.data },
  });

  const mutation = {
    onSuccess: async (res: { data: unknown }) => {
      toast.success(successMessage(res));
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getListJoinRequestsQueryKey(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: getListMembersQueryKey(projectId),
        }),
        // The sidebar's count comes from the project.
        queryClient.invalidateQueries({
          queryKey: getGetProjectQueryKey(projectId),
        }),
      ]);
    },
    onError: async (err: Error) => {
      decidedIndex.current = null;
      toast.error(err.message);
      // Someone else may have decided it meanwhile: show the list as it is now.
      await queryClient.invalidateQueries({
        queryKey: getListJoinRequestsQueryKey(projectId),
      });
    },
  };
  const approve = useApproveJoinRequest({ mutation });
  const decline = useDeclineJoinRequest({ mutation });
  const busy = approve.isPending || decline.isPending;

  useEffect(() => {
    if (decidedIndex.current === null || busy || !requests) return;
    const index = decidedIndex.current;
    decidedIndex.current = null;
    if (requests.length === 0) return onEmptied();
    const buttons =
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-approve]");
    buttons?.[Math.min(index, buttons.length - 1)]?.focus();
  }, [requests, busy, onEmptied]);

  if (!requests || requests.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="font-semibold">
          Join requests
        </h2>
        <p className="text-sm text-muted-foreground">
          People who asked to join through the invite link. Approving adds them
          as a Member.
        </p>
      </div>
      <ul ref={listRef} className="divide-y rounded-xl border bg-card">
        {requests.map((request, index) => (
          <JoinRequestRow
            key={request.id}
            request={request}
            busy={busy}
            onDecide={(yes) => {
              decidedIndex.current = index;
              const variables = { projectId, requestId: request.id };
              if (yes) approve.mutate(variables);
              else decline.mutate(variables);
            }}
          />
        ))}
      </ul>
    </section>
  );
};
