"use client";

import { LabelChip } from "@/components/items/label-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { useListLabels } from "@/lib/api/generated/labels/labels";
import { LabelRow } from "@/components/projects/label-row";
import { AddLabelRow } from "@/components/projects/add-label-row";

/**
 * The project's labels. Owners and managers (`canCreateLabels`) add labels and change
 * name and colour; only owners (`canEditSettings`) change a group or delete. Members see
 * them read-only. Two labels of one group can't be on the same item.
 */
export const LabelsSection = ({
  projectId,
  canCreateLabels,
  canEditSettings,
}: {
  projectId: string;
  canCreateLabels: boolean;
  canEditSettings: boolean;
}) => {
  const { data: labels, error } = useListLabels(projectId, {
    query: { select: (r) => r.data },
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Labels</h2>
        <p className="text-sm text-muted-foreground">
          An item can carry only one label of a group, like one type. Labels
          without a group combine freely.
        </p>
      </div>
      {error && <p role="alert">{error.message}</p>}
      {!labels && !error && <Skeleton className="h-32 w-full rounded-xl" />}
      {labels && labels.length === 0 && (
        <p className="text-sm text-muted-foreground">No labels yet.</p>
      )}
      {labels && labels.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {labels.map((label) =>
            canCreateLabels ? (
              <LabelRow
                key={label.id}
                projectId={projectId}
                label={label}
                canRegroup={canEditSettings}
              />
            ) : (
              <li
                key={label.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <LabelChip name={label.name} color={label.color} />
                {label.group && (
                  <span className="text-muted-foreground">
                    Group: {label.group}
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      {canCreateLabels ? (
        <AddLabelRow projectId={projectId} canRegroup={canEditSettings} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Only owners and managers can change labels.
        </p>
      )}
    </section>
  );
};
