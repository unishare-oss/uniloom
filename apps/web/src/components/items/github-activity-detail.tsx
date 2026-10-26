import type { ListItemActivity200Item } from "@/lib/api/generated/uniloomAPI.schemas";

type GithubRow = Extract<
  ListItemActivity200Item,
  { action: "item.move" | "github.done_skipped" }
>;

/**
 * Below a change GitHub made: one line per merged pull request ("PR #12 merged into dev by
 * @login", the number links to GitHub) and, for a skipped move, each reason in red.
 */
export const GithubActivityDetail = ({ row }: { row: GithubRow }) => {
  const pullRequests = row.detail.pullRequests ?? [];
  const reasons =
    row.action === "github.done_skipped" ? row.detail.reasons : [];
  if (pullRequests.length === 0 && reasons.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-0.5 border-l-2 pl-2.5 text-sm break-words text-muted-foreground">
      {pullRequests.map((pr) => (
        <p key={pr.number}>
          <a
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground hover:underline"
          >
            PR #{pr.number}
          </a>{" "}
          merged into {pr.base}
          {pr.mergedBy && <> by @{pr.mergedBy}</>}
        </p>
      ))}
      {reasons.map((reason) => (
        <p key={reason} className="text-destructive">
          {reason}
        </p>
      ))}
    </div>
  );
};
