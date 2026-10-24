"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { successMessage } from "@/lib/api/fetcher";
import {
  getGetProjectQueryKey,
  useUpdateProject,
} from "@/lib/api/generated/projects/projects";
import { buttonVariants } from "@/components/ui/button";
import { useListGithubRepositories } from "@/lib/api/generated/github/github";
import { GithubRepositoryRow } from "@/components/projects/github-repository-row";

/**
 * Owner only (the page shows it for `canEditSettings`): install the Uniloom GitHub App and map
 * repos to this project. Pull requests of a mapped repo link to tickets by the key in their
 * title, branch or description.
 */
export const GithubSettings = ({
  projectId,
  doneOnMerge,
}: {
  projectId: string;
  doneOnMerge: boolean;
}) => {
  const queryClient = useQueryClient();
  const update = useUpdateProject({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await queryClient.invalidateQueries({
          queryKey: getGetProjectQueryKey(projectId),
        });
      },
      onError: (err) => toast.error(err.message),
    },
  });
  const { data, error } = useListGithubRepositories(projectId, {
    query: { select: (r) => r.data },
  });

  return (
    <section id="github" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">GitHub</h2>
          <p className="text-sm text-muted-foreground">
            Pull requests in a mapped repo link to a ticket when their title,
            branch or description names its key, like UN-42.
          </p>
        </div>
        {data?.installUrl && (
          <a
            href={data.installUrl}
            className={buttonVariants({ variant: "outline" })}
          >
            Install on GitHub
          </a>
        )}
      </div>
      <label className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">
            Move to Done when merged into dev or main
          </span>
          <span className="text-sm text-muted-foreground">
            A ticket in In Review moves to Done when its pull request merges
            into dev or main, its checks passed, its checklist is ticked and
            nothing blocks it.
          </span>
        </span>
        <Switch
          aria-label="Move to Done when merged into dev or main"
          checked={doneOnMerge}
          disabled={update.isPending}
          onCheckedChange={(checked) =>
            update.mutate({ projectId, data: { doneOnMerge: checked } })
          }
        />
      </label>
      {error && <p role="alert">{error.message}</p>}
      {!data && !error && <Skeleton className="h-24 w-full rounded-xl" />}
      {data && data.repositories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No repositories yet. Install the App on GitHub, then come back.
        </p>
      )}
      {data && data.repositories.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {data.repositories.map((repository) => (
            <GithubRepositoryRow
              key={repository.id}
              projectId={projectId}
              repository={repository}
            />
          ))}
        </ul>
      )}
    </section>
  );
};
