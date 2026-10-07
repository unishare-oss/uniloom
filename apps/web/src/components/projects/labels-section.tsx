"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  LABEL_COLORS,
  LabelChip,
  labelColorName,
  type LabelColor,
} from "@/components/items/item-meta";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { successMessage } from "@/lib/api/fetcher";
import { getListItemsQueryKey } from "@/lib/api/generated/items/items";
import {
  getListLabelsQueryKey,
  useCreateLabel,
  useDeleteLabel,
  useListLabels,
  useUpdateLabel,
} from "@/lib/api/generated/labels/labels";
import type { ListLabels200Item } from "@/lib/api/generated/uniloomAPI.schemas";

const colorOptions = LABEL_COLORS.map((color) => ({
  value: color,
  label: labelColorName(color),
}));

const ColorSelect = ({
  value,
  onChange,
}: {
  value: LabelColor;
  onChange: (color: LabelColor) => void;
}) => {
  return (
    <Select
      value={value}
      onValueChange={(color) => onChange(color as LabelColor)}
      items={colorOptions}
    >
      <SelectTrigger aria-label="Colour" className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {colorOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/** One saved label, for owners and managers; group and Delete need `canRegroup`. */
const LabelRow = ({
  projectId,
  label,
  canRegroup,
}: {
  projectId: string;
  label: ListLabels200Item;
  canRegroup: boolean;
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState<LabelColor>(label.color);
  const [group, setGroup] = useState(label.group ?? "");
  const changed =
    name.trim() !== label.name ||
    color !== label.color ||
    group.trim() !== (label.group ?? "");

  // Items show label names and colours, so their lists refresh too.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListLabelsQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getListItemsQueryKey(projectId),
      }),
    ]);
  const update = useUpdateLabel({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await refresh();
      },
      onError: (err) => toast.error(err.message),
    },
  });
  const remove = useDeleteLabel({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await refresh();
      },
      onError: (err) => toast.error(err.message),
    },
  });

  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-3">
      <Input
        aria-label="Name"
        required
        maxLength={50}
        className="w-44"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <ColorSelect value={color} onChange={setColor} />
      <Input
        aria-label="Group"
        maxLength={50}
        className="w-36"
        placeholder="No group"
        value={group}
        disabled={!canRegroup}
        onChange={(event) => setGroup(event.target.value)}
      />
      <LabelChip name={name.trim() || label.name} color={color} />
      <span className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          disabled={update.isPending || !changed || !name.trim()}
          onClick={() =>
            update.mutate({
              id: label.id,
              data: {
                name: name.trim(),
                color,
                ...(canRegroup && { group: group.trim() || null }),
              },
            })
          }
        >
          Save
        </Button>
        {canRegroup && (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  aria-label={`Delete ${label.name}`}
                >
                  <Trash2 />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {label.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  It leaves every item that has it. This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: label.id })}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </span>
    </li>
  );
};

/** The add row; the group field is the owner's (`canRegroup`). */
const AddLabelRow = ({
  projectId,
  canRegroup,
}: {
  projectId: string;
  canRegroup: boolean;
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("GRAY");
  const [group, setGroup] = useState("");

  const create = useCreateLabel({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        setName("");
        setGroup("");
        await queryClient.invalidateQueries({
          queryKey: getListLabelsQueryKey(projectId),
        });
      },
      onError: (err) => toast.error(err.message),
    },
  });

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({
          projectId,
          data: {
            name: name.trim(),
            color,
            ...(canRegroup && group.trim() && { group: group.trim() }),
          },
        });
      }}
    >
      <Input
        aria-label="New label name"
        required
        maxLength={50}
        className="w-44"
        placeholder="New label"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <ColorSelect value={color} onChange={setColor} />
      {canRegroup && (
        <Input
          aria-label="New label group"
          maxLength={50}
          className="w-36"
          placeholder="No group"
          value={group}
          onChange={(event) => setGroup(event.target.value)}
        />
      )}
      <Button type="submit" disabled={create.isPending || !name.trim()}>
        Add
      </Button>
    </form>
  );
};

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
