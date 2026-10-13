"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";
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

/**
 * Asks before removing a member. While an invite link is live, the removed person could
 * walk back in through it, so the dialog offers to turn the link off too.
 */
export const RemoveMemberDialog = ({
  name,
  linkIsLive,
  busy,
  onRemove,
}: {
  name: string;
  linkIsLive: boolean;
  busy: boolean;
  /** Resolves when the member is gone; the dialog closes then. */
  onRemove: (alsoDeleteLink: boolean) => Promise<unknown>;
}) => {
  const [open, setOpen] = useState(false);
  const [alsoDeleteLink, setAlsoDeleteLink] = useState(true);
  const checkboxId = useId();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            aria-label={`Remove ${name}`}
          >
            <X />
            Remove
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access to this project, and their tickets become
            unassigned.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {linkIsLive && (
          <div className="flex items-start gap-2.5 text-sm">
            <input
              id={checkboxId}
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={alsoDeleteLink}
              onChange={(event) => setAlsoDeleteLink(event.target.checked)}
            />
            <label htmlFor={checkboxId} className="flex flex-col gap-0.5">
              <span className="font-medium">Also delete the invite link</span>
              <span className="text-muted-foreground">
                If you keep it, they can use it to rejoin.
              </span>
            </label>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            aria-busy={busy}
            onClick={() =>
              void onRemove(linkIsLive && alsoDeleteLink).then(
                () => setOpen(false),
                // The mutation already showed why: stay open so they can retry.
                () => undefined,
              )
            }
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
