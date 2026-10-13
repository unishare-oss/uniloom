"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, MessageSquareText } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { DeleteLinkDialog } from "@/components/members/delete-link-dialog";
import { inviteMessage } from "@/components/members/invite-message";
import {
  DEFAULT_CHOICES,
  InviteOptions,
  type InviteChoices,
} from "@/components/members/invite-options";
import { ReplaceLinkDialog } from "@/components/members/replace-link-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { successMessage } from "@/lib/api/fetcher";
import {
  getGetInviteQueryKey,
  useCreateInvite,
  useDeleteInvite,
  useGetInvite,
} from "@/lib/api/generated/invites/invites";
import type { CreateInvite201 } from "@/lib/api/generated/uniloomAPI.schemas";
import { formatDateTime, timeAgo } from "@/lib/time";

/** "2 of 10 people joined" or "2 of 10 requests", by the kind of link. */
const usedLine = (invite: CreateInvite201) => {
  const { useCount, maxUses } = invite;
  if (invite.joinApproval) {
    if (maxUses !== null) return `${useCount} of ${maxUses} requests`;
    return `${useCount} ${useCount === 1 ? "request" : "requests"}, no limit`;
  }
  if (maxUses !== null) return `${useCount} of ${maxUses} people joined`;
  return `${useCount} ${useCount === 1 ? "person" : "people"} joined, no limit`;
};

/**
 * The project's one invite link, for owners and managers: pick the options and create
 * it, then copy it, replace it or delete it.
 */
export const InviteLinkCard = ({
  projectId,
  projectName,
  waiting,
}: {
  projectId: string;
  projectName: string;
  /** People waiting for approval: the dialogs say their requests stay. */
  waiting: number;
}) => {
  const queryClient = useQueryClient();
  const headingId = useId();
  const linkId = useId();
  const [choices, setChoices] = useState<InviteChoices>(DEFAULT_CHOICES);
  const {
    data: invite,
    isSuccess,
    error,
    refetch,
  } = useGetInvite(projectId, {
    query: { select: (r) => r.data },
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: getGetInviteQueryKey(projectId),
    });
  const create = useCreateInvite({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await refresh();
      },
      onError: (err) => toast.error(err.message),
    },
  });
  const remove = useDeleteInvite({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await refresh();
      },
      onError: (err) => toast.error(err.message),
    },
  });
  const busy = create.isPending || remove.isPending;

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  };

  if (error)
    return (
      <section
        aria-labelledby={headingId}
        className="flex flex-col gap-3 rounded-xl border bg-card p-4"
      >
        <h2 id={headingId} className="font-semibold">
          Invite link
        </h2>
        <p role="alert" className="text-sm">
          Couldn&rsquo;t load the invite link. {error.message}
        </p>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        </div>
      </section>
    );
  if (!isSuccess) return null;
  const url = invite ? `${window.location.origin}/join/${invite.token}` : "";

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="font-semibold">
          Invite link
        </h2>
        <p className="text-sm text-muted-foreground">
          {invite?.joinApproval
            ? "Anyone with this link can ask to join. An owner or manager approves each request."
            : "Anyone with this link can join as a Member."}{" "}
          People new to Uniloom sign in first.
        </p>
      </div>

      {invite ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={linkId} className="text-sm font-medium">
              Link
            </label>
            <Input
              id={linkId}
              readOnly
              value={url}
              className="font-mono text-sm"
              onFocus={(event) => event.target.select()}
            />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Created</dt>
            <dd>
              <time dateTime={invite.createdAt}>
                {formatDateTime(invite.createdAt)}
              </time>
              {invite.createdBy && ` by ${invite.createdBy}`}
            </dd>
            <dt className="text-muted-foreground">
              {invite.state === "expired" ? "Expired" : "Expires"}
            </dt>
            <dd>
              <time dateTime={invite.expiresAt}>
                {formatDateTime(invite.expiresAt)}
              </time>{" "}
              ({timeAgo(invite.expiresAt)})
            </dd>
            <dt className="text-muted-foreground">Used</dt>
            <dd>
              {usedLine(invite)}
              {invite.state === "full" && " (limit reached)"}
            </dd>
          </dl>
          {invite.state !== "live" && (
            <p role="status" className="text-sm font-medium">
              {invite.state === "expired"
                ? "This link has expired. Create a new one to invite people."
                : "This link has reached its limit. Create a new one to invite more people."}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {invite.state === "live" && (
              <>
                <Button
                  type="button"
                  onClick={() => void copy(url, "Link copied")}
                >
                  <Copy />
                  Copy link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void copy(
                      inviteMessage({
                        invitedBy: invite.createdBy,
                        projectName,
                        url,
                        expiresAt: invite.expiresAt,
                        joinApproval: invite.joinApproval,
                      }),
                      "Invite message copied",
                    )
                  }
                >
                  <MessageSquareText />
                  Copy invite message
                </Button>
              </>
            )}
            <ReplaceLinkDialog
              currentWorks={invite.state === "live"}
              waiting={waiting}
              busy={busy}
              onCreate={(next) => create.mutateAsync({ projectId, data: next })}
            />
            <DeleteLinkDialog
              waiting={waiting}
              busy={busy}
              onDelete={() => remove.mutateAsync({ projectId })}
            />
          </div>
        </>
      ) : (
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({ projectId, data: choices });
          }}
        >
          <InviteOptions
            value={choices}
            onChange={setChoices}
            disabled={busy}
          />
          <Button type="submit" disabled={busy} aria-busy={busy}>
            <Link2 />
            Create link
          </Button>
        </form>
      )}
    </section>
  );
};
