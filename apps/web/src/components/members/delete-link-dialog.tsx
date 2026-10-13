"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
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
import { waitingNote } from "@/components/members/invite-message";

/** Asks before turning the invite link off. */
export const DeleteLinkDialog = ({
  waiting,
  busy,
  onDelete,
}: {
  /** People waiting for approval. */
  waiting: number;
  busy: boolean;
  /** Resolves when the link is gone; the dialog closes then. */
  onDelete: () => Promise<unknown>;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="destructive">
            <Trash2 />
            Delete link
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete the invite link?</AlertDialogTitle>
          <AlertDialogDescription>
            It stops working right away. People who already joined keep their
            access.
            {waitingNote(waiting)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            aria-busy={busy}
            onClick={() =>
              void onDelete().then(
                () => setOpen(false),
                // The mutation already showed why: stay open so they can retry.
                () => undefined,
              )
            }
          >
            Delete link
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
