"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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
import { successMessage } from "@/lib/api/fetcher";
import {
  getListMyJoinRequestsQueryKey,
  useCancelJoinRequest,
} from "@/lib/api/generated/invites/invites";

/** "Cancel request" with a confirmation, on the home page and on the join page. */
export const CancelRequestDialog = ({
  requestId,
  projectName,
  onCanceled,
}: {
  requestId: string;
  projectName: string;
  /** Runs once the request no longer waits, just before the lists refresh. */
  onCanceled?: () => void;
}) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const cancel = useCancelJoinRequest({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        setOpen(false);
        // Before the list refreshes, so the caller can note which row is going away.
        onCanceled?.();
        await queryClient.invalidateQueries({
          queryKey: getListMyJoinRequestsQueryKey(),
        });
      },
      // It was approved or declined meanwhile: show what is true now.
      onError: async (err) => {
        toast.error(err.message);
        setOpen(false);
        onCanceled?.();
        await queryClient.invalidateQueries({
          queryKey: getListMyJoinRequestsQueryKey(),
        });
      },
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={`Cancel request to join ${projectName}`}
            data-cancel-request
          >
            Cancel request
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Cancel your request to join {projectName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            You can ask again while the invite link works.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep waiting</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={cancel.isPending}
            aria-busy={cancel.isPending}
            onClick={() => cancel.mutate({ requestId })}
          >
            Cancel request
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
