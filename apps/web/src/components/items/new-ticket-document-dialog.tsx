"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FilePlus, Scale, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DOCUMENT_TEMPLATES } from "@/components/documents/document-templates";
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
import { Textarea } from "@/components/ui/textarea";
import { successMessage } from "@/lib/api/fetcher";
import {
  getGetItemQueryKey,
  useCreateTicketDocument,
} from "@/lib/api/generated/items/items";

const KINDS = {
  SPEC: {
    name: "spec",
    button: "New spec",
    placeholder: "e.g. Signup flow",
    icon: FilePlus,
    body: "",
  },
  ADR: {
    name: "ADR",
    button: "New ADR",
    placeholder: "e.g. Use Postgres",
    icon: Scale,
    body: DOCUMENT_TEMPLATES.ADR,
  },
  TECH_DEBT: {
    name: "tech debt",
    button: "Raise tech debt",
    placeholder: "e.g. Retry loop is copy-pasted",
    icon: Wrench,
    body: DOCUMENT_TEMPLATES.TECH_DEBT,
  },
};

/**
 * "New spec" / "New ADR" / "Raise tech debt": a title and Markdown, written from this
 * ticket; opens the new document. A spec stays on the ticket; an ADR or tech debt is kept
 * in Knowledge and linked here.
 */
export const NewTicketDocumentDialog = ({
  kind,
  projectId,
  itemId,
}: {
  kind: keyof typeof KINDS;
  projectId: string;
  itemId: string;
}) => {
  const { name, button, placeholder, icon: Icon, body: template } = KINDS[kind];
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState(template);
  const create = useCreateTicketDocument({
    mutation: {
      onSuccess: async (res) => {
        await queryClient.invalidateQueries({
          queryKey: getGetItemQueryKey(itemId),
        });
        toast.success(successMessage(res));
        setOpen(false);
        setTitle("");
        setBody(template);
        router.push(`/p/${projectId}/docs/${res.data.id}`);
      },
      onError: (err) => toast.error(err.message),
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Icon />
            {button}
          </Button>
        }
      />
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({
              id: itemId,
              data: { kind, title: title.trim(), body },
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{button}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticket-document-title">Title</Label>
            <Input
              id="ticket-document-title"
              required
              maxLength={200}
              placeholder={placeholder}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticket-document-body">{name} · Markdown</Label>
            <Textarea
              id="ticket-document-body"
              rows={8}
              className="max-h-[50dvh] min-h-48 overflow-y-auto font-mono text-[13px]"
              value={body}
              onChange={(event) => setBody(event.target.value)}
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
              disabled={create.isPending || title.trim() === ""}
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
