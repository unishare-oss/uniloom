"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { successMessage } from "@/lib/api/fetcher";
import {
  getListWorkspacesQueryKey,
  useCreateWorkspace,
} from "@/lib/api/generated/workspaces/workspaces";

const MODES = [
  {
    value: "GUIDED",
    label: "Guided",
    description:
      "Design first. Features and slices, fixed states, a 3 to 6 item checklist, and an approved design before Ready.",
  },
  {
    value: "STANDARD",
    label: "Standard",
    description:
      "Like Jira. Projects, issues and sub-issues, To Do → In Progress → Done, optional checklists.",
  },
] as const;

/** Name, key prefix and mode; opens the new workspace's board when it's created. */
export const NewWorkspaceDialog = ({ trigger }: { trigger: ReactElement }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [keyPrefix, setKeyPrefix] = useState("");
  const [mode, setMode] = useState<"GUIDED" | "STANDARD">("GUIDED");
  const create = useCreateWorkspace({
    mutation: {
      onSuccess: async (res) => {
        await queryClient.invalidateQueries({
          queryKey: getListWorkspacesQueryKey(),
        });
        setOpen(false);
        toast.success(successMessage(res));
        router.push(`/w/${res.data.id}`);
      },
      onError: (err) => toast.error(err.message),
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({ data: { name: name.trim(), keyPrefix, mode } });
          }}
        >
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>You&rsquo;ll be its owner.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              placeholder="e.g. Uniloom"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-key">Key prefix</Label>
            <Input
              id="workspace-key"
              placeholder="UL"
              required
              pattern="[A-Z]{2,5}"
              title="2 to 5 capital letters"
              className="w-32 font-mono uppercase"
              value={keyPrefix}
              onChange={(event) =>
                setKeyPrefix(
                  event.target.value.toUpperCase().replace(/[^A-Z]/g, ""),
                )
              }
            />
            <p className="text-sm text-muted-foreground">
              2 to 5 capital letters. Items are numbered {keyPrefix || "UL"}-1,{" "}
              {keyPrefix || "UL"}-2, …
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Mode</legend>
            <RadioGroup
              value={mode}
              onValueChange={(value) => setMode(value as typeof mode)}
            >
              {MODES.map((option) => (
                <Label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3.5 font-normal has-data-checked:border-primary"
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <span className="flex flex-col gap-1">
                    <span className="font-semibold">{option.label}</span>
                    <span className="text-sm leading-snug text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
