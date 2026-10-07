"use client";

import { LabelsSection } from "@/components/projects/labels-section";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import { SettingsForm } from "@/components/projects/settings-form";

/**
 * The project's name, rule switches and checklist limits. Owners edit; everyone else
 * sees the values read-only (`canEditSettings`). New rules apply from the next change.
 */
export const SettingsPage = ({ projectId }: { projectId: string }) => {
  const { data: project, error } = useGetProject(projectId, {
    query: { select: (r) => r.data },
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          The rules of this project. Changes apply from now on; existing
          checklists stay as they are.
        </p>
      </div>
      {error && <p role="alert">{error.message}</p>}
      {!project && !error && <Skeleton className="h-64 w-full rounded-xl" />}
      {project && <SettingsForm key={project.updatedAt} project={project} />}
      {project && (
        <LabelsSection
          projectId={project.id}
          canCreateLabels={project.canCreateLabels}
          canEditSettings={project.canEditSettings}
        />
      )}
    </main>
  );
};
