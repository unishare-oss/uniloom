"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { successMessage } from "@/lib/api/fetcher";
import {
  getListGithubRepositoriesQueryKey,
  useMapGithubRepository,
  useUnmapGithubRepository,
} from "@/lib/api/generated/github/github";
import type { ListGithubRepositories200RepositoriesItem } from "@/lib/api/generated/uniloomAPI.schemas";

/** One repo the GitHub App can see, with Map or Unmap. */
export const GithubRepositoryRow = ({
  projectId,
  repository,
}: {
  projectId: string;
  repository: ListGithubRepositories200RepositoriesItem;
}) => {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: getListGithubRepositoriesQueryKey(projectId),
    });
  const map = useMapGithubRepository({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await refresh();
      },
      onError: (err) => toast.error(err.message),
    },
  });
  const unmap = useUnmapGithubRepository({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await refresh();
      },
      onError: (err) => toast.error(err.message),
    },
  });
  const pending = map.isPending || unmap.isPending;
  const variables = { projectId, repositoryId: repository.id };

  return (
    <li className="flex items-center gap-3 px-4 py-3 text-sm">
      <span className="min-w-0 flex-1 truncate font-medium">
        {repository.fullName}
      </span>
      <span className="text-muted-foreground">
        {repository.mapped ? "Mapped" : "Not mapped"}
      </span>
      <Button
        type="button"
        size="sm"
        variant={repository.mapped ? "outline" : "default"}
        disabled={pending}
        onClick={() =>
          repository.mapped ? unmap.mutate(variables) : map.mutate(variables)
        }
      >
        {repository.mapped ? "Unmap" : "Map"}
      </Button>
    </li>
  );
};
