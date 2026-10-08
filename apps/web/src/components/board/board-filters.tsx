"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { KindIcon } from "@/components/items/kind-icon";
import { LabelDot } from "@/components/items/label-dot";
import { Avatar } from "@/components/user/avatar";
import { EmptyAvatar } from "@/components/user/empty-avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";
import { useListLabels } from "@/lib/api/generated/labels/labels";
import type {
  ListItems200Item,
  ListMembers200Item,
} from "@/lib/api/generated/uniloomAPI.schemas";

type Filters = {
  labelIds: string[];
  /** Member ids, plus "me" and "none" (unassigned). */
  assigneeIds: string[];
  parentId: string | null;
};

const ME = "me";
const NONE = "none";

const split = (value: string | null) => (value ? value.split(",") : []);

/** The board's filters as they are in the URL: `?label=a,b&assignee=me,none&parent=id`. */
export const readFilters = (searchParams: URLSearchParams): Filters => ({
  labelIds: split(searchParams.get("label")),
  assigneeIds: split(searchParams.get("assignee")),
  parentId: searchParams.get("parent"),
});

export const hasFilters = (filters: Filters) =>
  filters.labelIds.length > 0 ||
  filters.assigneeIds.length > 0 ||
  filters.parentId !== null;

/** Every set filter must pass; within one filter, any choice will do. */
export const matchesFilters = (
  item: ListItems200Item,
  filters: Filters,
  meId: string | undefined,
) => {
  const { labelIds, assigneeIds, parentId } = filters;
  if (
    labelIds.length > 0 &&
    !item.labels.some((label) => labelIds.includes(label.id))
  ) {
    return false;
  }
  if (assigneeIds.length > 0) {
    const wanted =
      item.assigneeId === null
        ? assigneeIds.includes(NONE)
        : assigneeIds.includes(item.assigneeId) ||
          (item.assigneeId === meId && assigneeIds.includes(ME));
    if (!wanted) return false;
  }
  if (parentId && item.id !== parentId && item.parentId !== parentId) {
    return false;
  }
  return true;
};

const triggerClass = "h-9 bg-card dark:bg-card";

/**
 * Label, assignee and parent (feature or task) dropdowns, and Clear. They write the URL
 * with `router.replace`, so a filtered board can be shared and filters don't pile up
 * in the browser history.
 */
export const BoardFilters = ({
  projectId,
  items,
  members,
}: {
  projectId: string;
  items: ListItems200Item[];
  members: ListMembers200Item[];
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = readFilters(searchParams);
  const { data: labels } = useListLabels(projectId, {
    query: { select: (r) => r.data },
  });
  const groups = [
    ...new Set((labels ?? []).flatMap((label) => label.group ?? [])),
  ].sort();
  const ungrouped = (labels ?? []).filter((label) => label.group === null);

  const setParam = (name: string, value: string[] | string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    const text = Array.isArray(value) ? value.join(",") : value;
    if (text) params.set(name, text);
    else params.delete(name);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const clear = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("label");
    params.delete("assignee");
    params.delete("parent");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const labelRow = (label: NonNullable<typeof labels>[number]) => (
    <SelectItem key={label.id} value={label.id}>
      <span className="flex items-center gap-2">
        <LabelDot color={label.color} />
        {label.name}
      </span>
    </SelectItem>
  );

  const pickedLabels = (labels ?? []).filter((label) =>
    filters.labelIds.includes(label.id),
  );
  const pickedMembers = members.filter((member) =>
    filters.assigneeIds.includes(member.userId),
  );
  const parent = items.find((item) => item.id === filters.parentId);

  return (
    <>
      <Select
        multiple
        value={filters.labelIds}
        onValueChange={(ids) => setParam("label", ids)}
      >
        <SelectTrigger aria-label="Filter by label" className={triggerClass}>
          {pickedLabels.length === 0 ? (
            <span className="text-muted-foreground">Label</span>
          ) : (
            <span className="flex items-center gap-2">
              {pickedLabels.map((label) => (
                <span key={label.id} className="flex items-center gap-1.5">
                  <LabelDot color={label.color} />
                  {label.name}
                </span>
              ))}
            </span>
          )}
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group}>
              <SelectLabel>{group}</SelectLabel>
              {(labels ?? [])
                .filter((label) => label.group === group)
                .map(labelRow)}
            </SelectGroup>
          ))}
          {groups.length > 0 && ungrouped.length > 0 && <SelectSeparator />}
          {ungrouped.length > 0 && (
            <SelectGroup>{ungrouped.map(labelRow)}</SelectGroup>
          )}
          {labels?.length === 0 && (
            <span className="block px-2 py-1.5 text-sm text-muted-foreground">
              No labels in this project
            </span>
          )}
        </SelectContent>
      </Select>

      <Select
        multiple
        value={filters.assigneeIds}
        onValueChange={(ids) => setParam("assignee", ids)}
      >
        <SelectTrigger aria-label="Filter by assignee" className={triggerClass}>
          {filters.assigneeIds.length === 0 ? (
            <span className="text-muted-foreground">Assignee</span>
          ) : (
            <span className="flex items-center gap-2">
              {filters.assigneeIds.includes(ME) && <span>Me</span>}
              {filters.assigneeIds.includes(NONE) && <EmptyAvatar />}
              {pickedMembers.map((member) => (
                <Avatar
                  key={member.userId}
                  name={member.name}
                  image={member.image}
                  size={20}
                />
              ))}
            </span>
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={ME}>Me</SelectItem>
            <SelectItem value={NONE}>
              <span className="flex items-center gap-2">
                <EmptyAvatar />
                Unassigned
              </span>
            </SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            {members.map((member) => (
              <SelectItem key={member.userId} value={member.userId}>
                <span className="flex items-center gap-2">
                  <Avatar name={member.name} image={member.image} size={20} />
                  {member.name}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        value={filters.parentId}
        onValueChange={(id) => setParam("parent", id)}
      >
        <SelectTrigger aria-label="Filter by item" className={triggerClass}>
          {parent ? (
            <span className="flex items-center gap-2">
              <KindIcon kind={parent.kind} />
              {parent.key}
            </span>
          ) : (
            <span className="text-muted-foreground">Item</span>
          )}
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              <span className="flex items-center gap-2">
                <KindIcon kind={item.kind} />
                <span className="text-muted-foreground">{item.key}</span>
                {item.title}
              </span>
            </SelectItem>
          ))}
          {items.length === 0 && (
            <span className="block px-2 py-1.5 text-sm text-muted-foreground">
              Nothing to pick yet
            </span>
          )}
        </SelectContent>
      </Select>

      {hasFilters(filters) && (
        <Button variant="ghost" className="h-9 px-2" onClick={clear}>
          <X />
          Clear
        </Button>
      )}
    </>
  );
};
