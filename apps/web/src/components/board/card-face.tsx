import { KindIcon } from "@/components/items/kind-icon";
import { LabelTag } from "@/components/items/label-tag";
import { PriorityIcon } from "@/components/items/priority-icon";
import { Avatar } from "@/components/user/avatar";
import { EmptyAvatar } from "@/components/user/empty-avatar";
import type {
  ListItems200Item,
  ListMembers200Item,
} from "@/lib/api/generated/uniloomAPI.schemas";
import { cn } from "@/lib/utils";

/** The card's face, shared by the card on the board and the one being dragged. */
export const CardFace = ({
  item,
  assignee,
  done,
}: {
  item: ListItems200Item;
  /** The member who has it, if any. */
  assignee?: ListMembers200Item;
  done: boolean;
}) => {
  return (
    <>
      <span className="text-sm leading-snug">{item.title}</span>
      {item.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.labels.map((label) => (
            <LabelTag key={label.id} name={label.name} color={label.color} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <KindIcon kind={item.kind} />
        <span
          className={cn(
            "text-xs font-semibold text-muted-foreground",
            done && "line-through",
          )}
        >
          {item.key}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <PriorityIcon priority={item.priority} />
          {assignee && (
            <span title={assignee.name}>
              <Avatar name={assignee.name} image={assignee.image} size={20} />
              <span className="sr-only">Assigned to {assignee.name}</span>
            </span>
          )}
          {item.assigneeId === null && (
            <span>
              <EmptyAvatar />
              <span className="sr-only">Unassigned</span>
            </span>
          )}
        </span>
      </div>
    </>
  );
};
