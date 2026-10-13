"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { waitingNote } from "@/components/members/invite-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DEFAULT_CHOICES,
  InviteOptions,
  type InviteChoices,
} from "@/components/members/invite-options";

/**
 * Picks the options for a new link and warns that the current one stops working. A link
 * is never edited: any change is a new link (ADR-0014).
 */
export const ReplaceLinkDialog = ({
  currentWorks,
  waiting,
  busy,
  onCreate,
}: {
  /** False when the current link is already expired or full: nothing to warn about. */
  currentWorks: boolean;
  /** People waiting for approval. */
  waiting: number;
  busy: boolean;
  /** Resolves when the new link exists; the dialog closes then. */
  onCreate: (choices: InviteChoices) => Promise<unknown>;
}) => {
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState(DEFAULT_CHOICES);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline">
            <RefreshCw />
            Create new link
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreate(choices).then(() => setOpen(false));
          }}
        >
          <DialogHeader>
            <DialogTitle>Create a new invite link?</DialogTitle>
            <DialogDescription>
              {currentWorks
                ? "The current link stops working right away. People who already joined stay in the project."
                : "The current link no longer works. The new one replaces it."}
              {waitingNote(waiting)}
            </DialogDescription>
          </DialogHeader>
          <InviteOptions
            value={choices}
            onChange={setChoices}
            disabled={busy}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              Create new link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
