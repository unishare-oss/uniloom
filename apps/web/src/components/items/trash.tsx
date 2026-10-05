"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KindIcon,
  StateLozenge,
  kindLabel,
} from "@/components/items/item-meta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { successMessage } from "@/lib/api/fetcher";
import {
  getListDeletedItemsQueryKey,
  getListItemsQueryKey,
  useListDeletedItems,
  useRestoreItem,
} from "@/lib/api/generated/items/items";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { timeAgo } from "@/lib/time";

/** Deleted items, newest first, each with Restore. */
export const Trash = ({ workspaceId }: { workspaceId: string }) => {
  const queryClient = useQueryClient();
  const { data: deleted, error } = useListDeletedItems(workspaceId, {
    query: { select: (r) => r.data },
  });
  const { data: workspace } = useGetWorkspace(workspaceId, {
    query: { select: (r) => r.data },
  });
  const restore = useRestoreItem({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getListDeletedItemsQueryKey(workspaceId),
          }),
          queryClient.invalidateQueries({
            queryKey: getListItemsQueryKey(workspaceId),
          }),
        ]);
      },
      onError: (err) => toast.error(err.message),
    },
  });
  const category = (stateId: string) =>
    workspace?.states.find((s) => s.id === stateId)?.category;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
        <p className="text-muted-foreground">
          Deleted items stay here until you restore them.
        </p>
      </div>

      {error && <p role="alert">{error.message}</p>}
      {!deleted && !error && <Skeleton className="h-40 w-full rounded-xl" />}
      {deleted?.length === 0 && (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          The trash is empty.
        </p>
      )}

      {!!deleted?.length && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Was in</th>
                <th className="px-4 py-3 font-medium">Deleted</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {deleted.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <span className="mr-2.5 text-xs font-semibold text-muted-foreground">
                      {item.key}
                    </span>
                    {item.title}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <KindIcon kind={item.kind} />
                      {kindLabel(item.kind)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StateLozenge
                      name={item.state.name}
                      category={category(item.state.id)}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {timeAgo(item.deletedAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="outline"
                      disabled={restore.isPending}
                      onClick={() => restore.mutate({ id: item.id })}
                    >
                      Restore
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
};
