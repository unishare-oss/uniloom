"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type LabelColor } from "@/components/items/item-meta";
import { LabelChip } from "@/components/items/label-chip";
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
import { successMessage } from "@/lib/api/fetcher";
import { getListItemsQueryKey } from "@/lib/api/generated/items/items";
import {
  getListLabelsQueryKey,
  useDeleteLabel,
  useUpdateLabel,
} from "@/lib/api/generated/labels/labels";
import type { ListLabels200Item } from "@/lib/api/generated/uniloomAPI.schemas";
import { ColorSelect } from "@/components/projects/color-select";

/** One saved label, for owners and managers; group and Delete need `canRegroup`. */
export const LabelRow = ({
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
