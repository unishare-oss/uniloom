"use client";

import { Columns3, Plus } from "lucide-react";
import Link from "next/link";
import { NewWorkspaceDialog } from "@/components/workspaces/new-workspace-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useListWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { formatDate } from "@/lib/time";

const pill =
  "rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase";

/** Your workspaces as cards; each opens its board. */
export const WorkspaceList = () => {
  const { data: workspaces, error } = useListWorkspaces({
    query: { select: (r) => r.data },
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground">
            Pick one to open its board, or start a new one.
          </p>
        </div>
        <NewWorkspaceDialog
          trigger={
            <Button className="h-11 rounded-xl border-2 border-ink px-4 text-[15px] font-semibold shadow-hard hover:bg-primary/90">
              <Plus />
              New workspace
            </Button>
          }
        />
      </div>

      {error && (
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      )}

      {workspaces?.length === 0 && (
        <p className="rounded-xl border-2 border-dashed p-10 text-center text-muted-foreground">
          No workspaces yet. Create one to get a board.
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
        {!workspaces &&
          !error &&
          [0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-[212px] rounded-xl" />
          ))}
        {workspaces?.map((workspace) => (
          <Link
            key={workspace.id}
            href={`/w/${workspace.id}`}
            className="flex flex-col overflow-hidden rounded-xl border-2 border-ink bg-card shadow-hard transition-transform hover:-translate-y-0.5"
          >
            {/* Graph paper with a board, standing in for a preview. */}
            <div className="flex h-24 items-center justify-center border-b-2 border-ink bg-muted bg-[linear-gradient(var(--grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--grid-line)_1px,transparent_1px)] bg-size-[20px_20px]">
              <Columns3
                className="size-9 text-muted-foreground/60"
                strokeWidth={1.5}
              />
            </div>
            <div className="flex flex-col gap-2.5 p-5">
              <span className="truncate text-[17px] font-semibold tracking-tight">
                {workspace.name}
              </span>
              <div className="flex flex-wrap gap-2">
                <span
                  className={
                    workspace.mode === "GUIDED"
                      ? `${pill} bg-accent text-accent-foreground`
                      : `${pill} bg-secondary text-secondary-foreground`
                  }
                >
                  {workspace.mode === "GUIDED" ? "Guided" : "Standard"}
                </span>
                <span
                  className={`${pill} bg-secondary text-secondary-foreground`}
                >
                  {workspace.keyPrefix}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                Created {formatDate(workspace.createdAt)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
};
