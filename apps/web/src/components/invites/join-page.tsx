"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { successMessage } from "@/lib/api/fetcher";
import {
  getPreviewInviteQueryKey,
  useJoinByInvite,
  usePreviewInvite,
} from "@/lib/api/generated/invites/invites";
import { getListProjectsQueryKey } from "@/lib/api/generated/projects/projects";

/** A heading and a way onward for each reason a link lets nobody in. */
const DEAD_LINKS: Record<string, { title: string; hint: string }> = {
  invite_expired: {
    title: "This invite link has expired",
    hint: "Ask the person who sent it for a new one.",
  },
  invite_full: {
    title: "This invite link is full",
    hint: "Everyone it could let in has joined. Ask for a new one.",
  },
  invite_not_found: {
    title: "This invite link doesn't work",
    hint: "It may have been replaced or deleted. Ask for a new one.",
  },
};

/**
 * Where an invite link leads: which project it is and a button to join, or to ask when
 * the link needs approval. Joining is a button press, never the page load, so a link
 * preview in a chat app can't add anyone.
 */
export const JoinPage = ({ token }: { token: string }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    data: preview,
    error,
    refetch,
  } = usePreviewInvite(token, {
    // An expired link shows its message at once instead of after three retries.
    query: { select: (r) => r.data, retry: false },
  });
  const join = useJoinByInvite({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        if (res.data.result === "requested") {
          // The preview now says the request is waiting.
          await queryClient.invalidateQueries({
            queryKey: getPreviewInviteQueryKey(token),
          });
          return;
        }
        await queryClient.invalidateQueries({
          queryKey: getListProjectsQueryKey(),
        });
        router.replace(`/p/${res.data.projectId}`);
      },
      // The link may have expired or filled up since the page loaded: show that state.
      onError: async (err) => {
        toast.error(err.message);
        await queryClient.invalidateQueries({
          queryKey: getPreviewInviteQueryKey(token),
        });
      },
    },
  });

  // Someone already in the project goes straight to it.
  useEffect(() => {
    if (preview?.isMember) router.replace(`/p/${preview.projectId}`);
  }, [preview, router]);

  const dead = error ? DEAD_LINKS[error.code] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col px-6 py-12">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
        {!preview && !error && (
          <Skeleton className="h-28 w-full" aria-label="Loading the invite" />
        )}

        {error && (
          <div role="alert" className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {dead?.title ?? "Couldn't open this invite link"}
            </h1>
            <p className="text-muted-foreground">
              {dead?.hint ?? error.message}
            </p>
          </div>
        )}
        {error && (
          <div className="flex flex-wrap gap-2">
            {!dead && (
              <Button type="button" onClick={() => void refetch()}>
                Try again
              </Button>
            )}
            <Button variant="outline" render={<Link href="/" />}>
              Go to your projects
            </Button>
          </div>
        )}

        {preview && !preview.isMember && preview.request === "PENDING" && (
          <div role="status" className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight wrap-break-word">
              Request sent
            </h1>
            <p className="text-muted-foreground">
              You&rsquo;ll get into {preview.projectName} once an owner or
              manager approves it. Check back here or in your projects.
            </p>
          </div>
        )}
        {preview && !preview.isMember && preview.request === "PENDING" && (
          <div>
            <Button variant="outline" render={<Link href="/" />}>
              Go to your projects
            </Button>
          </div>
        )}

        {preview && !preview.isMember && preview.request === null && (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight wrap-break-word">
                Join {preview.projectName}
              </h1>
              <p className="text-muted-foreground">
                {preview.invitedBy
                  ? `${preview.invitedBy} invited you to this project.`
                  : "You're invited to this project."}{" "}
                {preview.joinApproval
                  ? "An owner or manager approves each request."
                  : "You'll join as a Member."}
              </p>
            </div>
            <div>
              <Button
                type="button"
                disabled={join.isPending || join.isSuccess}
                aria-busy={join.isPending}
                onClick={() => join.mutate({ token })}
              >
                {preview.joinApproval
                  ? join.isPending
                    ? "Sending…"
                    : "Ask to join"
                  : join.isPending
                    ? "Joining…"
                    : "Join project"}
              </Button>
            </div>
          </>
        )}

        {preview?.isMember && (
          <p role="status" className="text-muted-foreground">
            You&rsquo;re already in {preview.projectName}. Opening it…
          </p>
        )}
      </div>
    </main>
  );
};
