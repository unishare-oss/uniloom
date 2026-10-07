"use client";

import { UserMinus, UserPlus } from "lucide-react";
import { Avatar } from "@/components/user/avatar";
import { EmptyAvatar } from "@/components/user/empty-avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListMembers } from "@/lib/api/generated/members/members";
import { useGetMe } from "@/lib/api/generated/users/users";

const UNASSIGNED = "unassigned";

/**
 * Who has the item. Owners and managers (`canAssignOthers`) pick anyone; a member sees
 * who has it, with Claim when it's free (and `canClaim`) and Unclaim when it's theirs. The
 * API enforces it.
 */
export const AssigneeField = ({
  projectId,
  assigneeId,
  canAssignOthers,
  canClaim,
  onChange,
}: {
  projectId: string;
  assigneeId: string | null;
  canAssignOthers: boolean;
  canClaim: boolean;
  onChange: (assigneeId: string | null) => void;
}) => {
  const { data: members } = useListMembers(projectId, {
    query: { select: (r) => r.data },
  });
  const { data: me } = useGetMe({ query: { select: (r) => r.data } });
  const assignee = members?.find((member) => member.userId === assigneeId);

  if (canAssignOthers) {
    const options = [
      { value: UNASSIGNED, label: "Unassigned" },
      ...(members ?? []).map((member) => ({
        value: member.userId,
        label: member.name,
      })),
    ];
    return (
      <Select
        value={assigneeId ?? UNASSIGNED}
        onValueChange={(value) =>
          onChange(value === UNASSIGNED ? null : (value as string))
        }
        items={options}
      >
        <SelectTrigger
          aria-label="Assignee"
          className="w-full hover:bg-muted/50 focus-visible:bg-muted/50"
        >
          {assignee && (
            <Avatar name={assignee.name} image={assignee.image} size={20} />
          )}
          {assigneeId === null && <EmptyAvatar />}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {assignee && (
        <>
          <Avatar name={assignee.name} image={assignee.image} size={20} />
          <span className="min-w-0 truncate text-sm">{assignee.name}</span>
        </>
      )}
      {assigneeId === null && (
        <>
          <EmptyAvatar />
          <span className="text-sm text-muted-foreground">Unassigned</span>
        </>
      )}
      {me && canClaim && assigneeId === null && (
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => onChange(me.id)}
        >
          <UserPlus />
          Claim
        </Button>
      )}
      {me && assigneeId === me.id && (
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => onChange(null)}
        >
          <UserMinus />
          Unclaim
        </Button>
      )}
    </div>
  );
};
