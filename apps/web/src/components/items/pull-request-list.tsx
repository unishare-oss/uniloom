"use client";

import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Clock,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
} from "lucide-react";
import { CollapsibleSection } from "@/components/collapsible-section";
import { useListItemPullRequests } from "@/lib/api/generated/github/github";
import type { ListItemPullRequests200Item } from "@/lib/api/generated/uniloomAPI.schemas";

const STATE_ICONS = {
  OPEN: GitPullRequest,
  MERGED: GitMerge,
  CLOSED: GitPullRequestClosed,
};
const STATE_LABELS = { OPEN: "Open", MERGED: "Merged", CLOSED: "Closed" };

const CheckIcon = ({
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

/** The GitHub pull requests that name this ticket. Shows nothing until one is linked. */
export const PullRequestList = ({ itemId }: { itemId: string }) => {
  const { data: pullRequests } = useListItemPullRequests(itemId, {
    query: { select: (r) => r.data },
  });
  if (!pullRequests || pullRequests.length === 0) return null;

  return (
    <CollapsibleSection
      id="pull-requests"
      title="Pull requests"
      count={pullRequests.length}
    >
      <ul className="mt-3 overflow-hidden rounded-lg border bg-card">
        {pullRequests.map((pr) => {
          const StateIcon = STATE_ICONS[pr.state];
          return (
            <li
              key={`${pr.repository}#${pr.number}`}
              className="flex items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0"
            >
              <StateIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-label={STATE_LABELS[pr.state]}
              />
              <a
                href={pr.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex min-w-0 flex-1 items-baseline gap-2 hover:underline"
              >
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {pr.repository}#{pr.number}
                </span>
                <span className="truncate">{pr.title}</span>
              </a>
              <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
                {pr.headRef}
                <ArrowRight className="size-3" />
                {pr.baseRef}
              </span>
              <CheckIcon checks={pr.checks} />
            </li>
          );
        })}
      </ul>
    </CollapsibleSection>
  );
};
