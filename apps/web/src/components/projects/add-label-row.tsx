"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { type LabelColor } from "@/components/items/item-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { successMessage } from "@/lib/api/fetcher";
import {
  getListLabelsQueryKey,
  useCreateLabel,
} from "@/lib/api/generated/labels/labels";
import { ColorSelect } from "@/components/projects/color-select";

/** The add row; the group field is the owner's (`canRegroup`). */
export const AddLabelRow = ({
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
