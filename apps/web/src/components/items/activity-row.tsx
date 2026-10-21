import { AgentBadge, AgentMark } from "@/components/agent/agent-brand";
import { ActivitySentence } from "@/components/items/activity-sentence";
import type { StateCategory } from "@/components/items/item-meta";
import { Avatar } from "@/components/user/avatar";
import type { ListItemActivity200Item } from "@/lib/api/generated/uniloomAPI.schemas";
import { formatDate, timeAgo } from "@/lib/time";

/** One entry of the timeline: avatar (a robot badge for an agent), sentence, time. */
export const ActivityRow = ({
  row,
  itemKey,
  states,
}: {
  row: ListItemActivity200Item;
  itemKey: string;
  states: { name: string; key: string | null; category: StateCategory }[];
}) => {
  const person = row.by.name ?? "Someone";
  return (
    <div className="relative grid grid-cols-[28px_1fr] items-start gap-x-3 py-2 sm:grid-cols-[28px_1fr_auto]">
      <span className="relative">
        <Avatar
          name={person}
          image={row.by.image}
          size={28}
          className="ring-4 ring-background"
        />
        {row.agent && (
          <span
            title="Made by an agent"
            className="absolute -right-1.5 -bottom-1.5 inline-flex size-4 items-center justify-center rounded-full border bg-card text-primary"
          >
            <AgentMark name={row.agent.name} />
          </span>
        )}
      </span>
      <div className="min-w-0 pt-1 text-sm leading-6">
        <span className="font-semibold">{person}</span>
        {row.agent &&
          (row.agent.name ? (
            <>
              {" "}
              <AgentBadge name={row.agent.name} />
            </>
          ) : (
            "'s agent"
          ))}{" "}
        <ActivitySentence row={row} itemKey={itemKey} states={states} />
        {row.action === "checklist.tick" && row.detail.evidence && (
          <p className="mt-1.5 border-l-2 pl-2.5 text-sm break-words text-muted-foreground">
            Evidence: {row.detail.evidence}
          </p>
        )}
      </div>
      <time
        dateTime={row.at}
        title={formatDate(row.at)}
        className="col-start-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums sm:col-start-3 sm:pt-1.5 sm:text-sm"
      >
        {timeAgo(row.at)}
      </time>
    </div>
  );
};
