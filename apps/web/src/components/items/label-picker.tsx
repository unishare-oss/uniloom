"use client";

import { LabelDot } from "@/components/items/label-dot";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";
import type { GetItem200 } from "@/lib/api/generated/uniloomAPI.schemas";
import { useListLabels } from "@/lib/api/generated/labels/labels";

/**
 * The project's labels as a multi-select, under their group headings. Picking a
 * label swaps out the other one of its group; the API refuses two of one group too.
 */
export const LabelPicker = ({
  projectId,
  labels,
  onChange,
}: {
  projectId: string;
  labels: GetItem200["labels"];
  onChange: (labels: GetItem200["labels"]) => void;
}) => {
  const { data: all } = useListLabels(projectId, {
    query: { select: (r) => r.data },
  });
  // Grouped labels under their group's heading, then the free ones.
  const groups = [
    ...new Set((all ?? []).flatMap((label) => label.group ?? [])),
  ].sort();
  const ungrouped = (all ?? []).filter((label) => label.group === null);

  return (
    <Select
      multiple
      value={labels.map((l) => l.id)}
      onValueChange={(ids) => {
        // One label per group: picking a label drops the other one of its group.
        const added = (all ?? []).find(
          (l) => ids.includes(l.id) && !labels.some((on) => on.id === l.id),
        );
        onChange(
          (all ?? [])
            .filter((l) => ids.includes(l.id))
            .filter(
              (l) =>
                !added ||
                l.id === added.id ||
                added.group === null ||
                l.group !== added.group,
            )
            .map((l) => ({ id: l.id, name: l.name, color: l.color })),
        );
      }}
    >
      <SelectTrigger
        aria-label="Labels"
        className="min-h-8 w-full py-1.5 hover:bg-muted/50 focus-visible:bg-muted/50 data-[size=default]:h-auto"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          {labels.map((label) => (
            <span key={label.id} className="flex items-center gap-1.5">
              <LabelDot color={label.color} />
              {label.name}
            </span>
          ))}
          {labels.length === 0 && (
            <span className="text-muted-foreground">No labels</span>
          )}
        </span>
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {(all ?? [])
              .filter((label) => label.group === group)
              .map((label) => (
                <SelectItem key={label.id} value={label.id}>
                  <span className="flex items-center gap-2">
                    <LabelDot color={label.color} />
                    {label.name}
                  </span>
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
        {groups.length > 0 && ungrouped.length > 0 && <SelectSeparator />}
        {ungrouped.length > 0 && (
          <SelectGroup>
            {ungrouped.map((label) => (
              <SelectItem key={label.id} value={label.id}>
                <span className="flex items-center gap-2">
                  <LabelDot color={label.color} />
                  {label.name}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {all?.length === 0 && (
          <span className="block px-2 py-1.5 text-sm text-muted-foreground">
            No labels in this project
          </span>
        )}
      </SelectContent>
    </Select>
  );
};
