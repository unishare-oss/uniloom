"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import {
  KINDS_BY_MODE,
  PRIORITIES,
  kindLabel,
  priorityLabel,
  type ItemKind,
  type Priority,
} from "@/components/items/item-meta";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { successMessage } from "@/lib/api/fetcher";
import {
  getListItemsQueryKey,
  useCreateItem,
} from "@/lib/api/generated/items/items";
import type {
  GetWorkspace200,
  ListItems200Item,
} from "@/lib/api/generated/uniloomAPI.schemas";

const NO_PARENT = "none";

/**
 * Kind, title, parent, priority and description. The item starts in the first state; the
 * API checks which kinds may sit under which.
 */
export const NewItemDialog = ({
  workspace,
  items,
  trigger,
}: {
  workspace: GetWorkspace200;
  items: ListItems200Item[];
  trigger: ReactElement;
}) => {
  const queryClient = useQueryClient();
  const kinds = KINDS_BY_MODE[workspace.mode];
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ItemKind>(kinds[0]!);
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState(NO_PARENT);
  const [priority, setPriority] = useState<Priority>("NONE");
  const [description, setDescription] = useState("");
  const create = useCreateItem({
    mutation: {
      onSuccess: async (res) => {
        await queryClient.invalidateQueries({
          queryKey: getListItemsQueryKey(workspace.id),
        });
        toast.success(successMessage(res));
        setOpen(false);
        setTitle("");
        setDescription("");
        setParentId(NO_PARENT);
      },
      onError: (err) => toast.error(err.message),
    },
  });

  const parents = [
    { value: NO_PARENT, label: "No parent" },
    ...items.map((item) => ({
      value: item.id,
      label: `${item.key} · ${item.title}`,
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({
              workspaceId: workspace.id,
              data: {
                kind,
                title: title.trim(),
                priority,
                parentId: parentId === NO_PARENT ? null : parentId,
                ...(description.trim() && { description }),
              },
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>New item</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Kind</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as ItemKind)}
                items={kinds.map((k) => ({ value: k, label: kindLabel(k) }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((k) => (
                    <SelectItem key={k} value={k}>
                      {kindLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as Priority)}
                items={PRIORITIES.map((p) => ({
                  value: p,
                  label: priorityLabel(p),
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {priorityLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="item-title">Title</Label>
            <Input
              id="item-title"
              placeholder="e.g. Sign in with uniAuth"
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Parent</Label>
            <Select
              value={parentId}
              onValueChange={(value) => setParentId(value as string)}
              items={parents}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {parents.map((parent) => (
                  <SelectItem key={parent.value} value={parent.value}>
                    {parent.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="item-description">Description · Markdown</Label>
            <Textarea
              id="item-description"
              placeholder="What it is and when it's done. Markdown and ```mermaid diagrams work."
              rows={5}
              className="font-mono text-[13px]"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
