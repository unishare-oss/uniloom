"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/user/avatar";
import type { ListJoinRequests200Item } from "@/lib/api/generated/uniloomAPI.schemas";
import { timeAgo } from "@/lib/time";

/** One person waiting to be let in, with Approve and Decline. */
export const JoinRequestRow = ({
  request,
  busy,
  onDecide,
}: {
  request: ListJoinRequests200Item;
  busy: boolean;
  onDecide: (approve: boolean) => void;
}) => (
  <li className="flex flex-wrap items-center gap-3 px-4 py-3">
    <Avatar name={request.name} image={request.image} size={36} />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate font-medium">{request.name}</span>
      <span className="truncate text-sm text-muted-foreground">
        {request.email} · asked {timeAgo(request.requestedAt)}
      </span>
    </span>
    {/* The names make each pair of buttons tell its person to a screen reader. */}
    <Button
      type="button"
      disabled={busy}
      aria-label={`Approve ${request.name}`}
      data-approve
      onClick={() => onDecide(true)}
    >
      <Check />
      Approve
    </Button>
    <Button
      type="button"
      variant="outline"
      disabled={busy}
      aria-label={`Decline ${request.name}`}
      onClick={() => onDecide(false)}
    >
      <X />
      Decline
    </Button>
  </li>
);
