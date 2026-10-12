import { Bot } from "lucide-react";
import { ActivitySentence } from "@/components/items/activity-sentence";
import { Avatar } from "@/components/user/avatar";
import type { ListItemActivity200Item } from "@/lib/api/generated/uniloomAPI.schemas";
import { formatDate, timeAgo } from "@/lib/time";

/** One line of the history: avatar (a robot badge for an agent), sentence, time. */
export const ActivityRow = ({ row }: { row: ListItemActivity200Item }) => {
  const person = row.by.name ?? "Someone";
  return (
    <div className="flex flex-col gap-1 border-b px-3.5 py-2.5 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <span className="relative shrink-0">
          <Avatar name={person} image={row.by.image} size={20} />
          {row.agent && (
            <span
              title="Made by an agent"
              className="absolute -right-1 -bottom-1 inline-flex size-3.5 items-center justify-center rounded-full border bg-card text-muted-foreground"
            >
              <Bot className="size-2.5" />
            </span>
          )}
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{person}</span>
          {row.agent &&
            (row.agent.name ? (
              <>
                {" · "}
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {row.agent.name}
                </span>
              </>
            ) : (
              "'s agent"
            ))}{" "}
          <ActivitySentence row={row} />
        </p>
        <time
          dateTime={row.at}
          title={formatDate(row.at)}
          className="shrink-0 text-xs text-muted-foreground"
        >
          {timeAgo(row.at)}
        </time>
      </div>
      {row.action === "checklist.tick" && row.detail.evidence && (
        <p className="pl-[30px] text-xs break-words text-muted-foreground">
          Evidence: {row.detail.evidence}
        </p>
      )}
    </div>
  );
};
