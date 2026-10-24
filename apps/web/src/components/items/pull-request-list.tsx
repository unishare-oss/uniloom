"use client";

import {
  ArrowRight,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
} from "lucide-react";
import { CollapsibleSection } from "@/components/collapsible-section";
import { CheckIcon } from "@/components/items/check-icon";
import { useListItemPullRequests } from "@/lib/api/generated/github/github";

const STATE_ICONS = {
  OPEN: GitPullRequest,
  MERGED: GitMerge,
  CLOSED: GitPullRequestClosed,
};
const STATE_LABELS = { OPEN: "Open", MERGED: "Merged", CLOSED: "Closed" };

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
