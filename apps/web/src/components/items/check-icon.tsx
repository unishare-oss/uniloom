import { CircleCheck, CircleX, Clock } from "lucide-react";
import type { ListItemPullRequests200Item } from "@/lib/api/generated/uniloomAPI.schemas";

/** A pull request's check result as an icon; nothing when the repo has no checks. */
export const CheckIcon = ({
  checks,
}: {
  checks: ListItemPullRequests200Item["checks"];
}) => {
  if (checks === "success")
    return <CircleCheck className="size-4" aria-label="Checks passed" />;
  if (checks === "failure")
    return (
      <CircleX className="size-4 text-destructive" aria-label="Checks failed" />
    );
  if (checks === "pending")
    return (
      <Clock
        className="size-4 text-muted-foreground"
        aria-label="Checks running"
      />
    );
  return null;
};
