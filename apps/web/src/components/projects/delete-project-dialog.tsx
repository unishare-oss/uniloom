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
import { successMessage } from "@/lib/api/fetcher";
import {
  getGetProjectQueryKey,
  getListProjectsQueryKey,
  useDeleteProject,
} from "@/lib/api/generated/projects/projects";

/** Delete stays disabled until the exact project name is typed; then goes to the list. */
export const DeleteProjectDialog = ({
  projectId,
  projectName,
  trigger,
}: {
  projectId: string;
  projectName: string;
  trigger: ReactElement;
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const remove = useDeleteProject({
    mutation: {
      onSuccess: async (res) => {
        setOpen(false);
        toast.success(successMessage(res));
        router.push("/");
        await queryClient.invalidateQueries({
          queryKey: getListProjectsQueryKey(),
        });
        queryClient.removeQueries({
          queryKey: getGetProjectQueryKey(projectId),
        });
      },
      onError: (err) => toast.error(err.message),
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setTyped("");
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            remove.mutate({ projectId });
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete {projectName}?</DialogTitle>
            <DialogDescription>
              Everyone loses access to this project, its tickets and its
              documents.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-project-name">
              Type the project name to confirm
            </Label>
            <Input
              id="confirm-project-name"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
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
            <Button
              type="submit"
              variant="destructive"
              disabled={typed !== projectName || remove.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
