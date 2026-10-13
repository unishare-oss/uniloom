"use client";

import { CancelRequestDialog } from "@/components/invites/cancel-request-dialog";
import { ProjectChip } from "@/components/projects/project-chip";
import type { ListMyJoinRequests200Item } from "@/lib/api/generated/uniloomAPI.schemas";
import { timeAgo } from "@/lib/time";

/** A project the person asked to join and isn't in yet. */
export const PendingRequestRow = ({
  request,
  onCanceled,
}: {
  request: ListMyJoinRequests200Item;
  onCanceled: () => void;
}) => (
  <li className="flex flex-wrap items-center gap-3 px-4 py-3">
    <ProjectChip keyPrefix={request.keyPrefix} />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate font-medium">{request.projectName}</span>
      <span className="text-sm text-muted-foreground">
        Requested {timeAgo(request.requestedAt)}
      </span>
    </span>
    <CancelRequestDialog
      requestId={request.id}
      projectName={request.projectName}
      onCanceled={onCanceled}
    />
  </li>
);
