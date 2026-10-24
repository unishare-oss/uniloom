"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { useListGithubRepositories } from "@/lib/api/generated/github/github";
import { GithubRepositoryRow } from "@/components/projects/github-repository-row";

/**
 * Owner only (the page shows it for `canEditSettings`): install the Uniloom GitHub App and map
 * repos to this project. Pull requests of a mapped repo link to tickets by the key in their
 * title, branch or description.
 */
export const GithubSettings = ({ projectId }: { projectId: string }) => {
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
