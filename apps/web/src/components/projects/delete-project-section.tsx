"use client";

import { Button } from "@/components/ui/button";
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";

/** The danger zone of the settings page. The page shows it only when `canDeleteProject`. */
export const DeleteProjectSection = ({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) => (
  <section className="flex items-center justify-between gap-4 rounded-xl border border-destructive/40 p-4">
    <div className="flex flex-col gap-1">
      <h2 className="font-semibold">Delete project</h2>
      <p className="text-sm text-muted-foreground">
        Hides the project from everyone, tickets and documents included.
      </p>
    </div>
    <DeleteProjectDialog
      projectId={projectId}
      projectName={projectName}
      trigger={<Button variant="destructive">Delete project</Button>}
    />
  </section>
);
