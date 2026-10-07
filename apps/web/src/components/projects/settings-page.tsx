"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LabelsSection } from "@/components/projects/labels-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { successMessage } from "@/lib/api/fetcher";
import {
  getGetProjectQueryKey,
  getListProjectsQueryKey,
  useGetProject,
  useUpdateProject,
} from "@/lib/api/generated/projects/projects";
import type { GetProject200 } from "@/lib/api/generated/uniloomAPI.schemas";

/** `available: false` = stored, but no rule reads it until designs ship (§14 step 7). */
const SWITCHES = [
  {
    key: "checklistRequired",
    label: "Checklist required",
    description:
      "Slices and subtasks need their done-when entries to move to In Review.",
    available: true,
  },
  {
    key: "designRequired",
    label: "Design required",
    description: "A slice needs a design before it can be Ready.",
    available: false,
  },
  {
    key: "approvalRequired",
    label: "Approval required",
    description: "A design needs approval before work starts.",
    available: false,
  },
  {
    key: "approverNotAuthor",
    label: "Approver is not the author",
    description: "Nobody approves their own design.",
    available: false,
  },
  {
    key: "plannedVsActual",
    label: "Planned vs actual",
    description: "Record what was planned and what actually changed.",
    available: false,
  },
  {
    key: "selfClaimAllowed",
    label: "Members can claim tickets",
    description:
      "When off, only owners and managers assign tickets; members can still unclaim their own.",
    available: true,
  },
] as const;

const toLimit = (text: string) => (text.trim() === "" ? null : Number(text));

/** The form, started from the saved project; remounted after each save. */
const SettingsForm = ({ project }: { project: GetProject200 }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(project.name);
  const [flags, setFlags] = useState({
    checklistRequired: project.checklistRequired,
    designRequired: project.designRequired,
    approvalRequired: project.approvalRequired,
    approverNotAuthor: project.approverNotAuthor,
    plannedVsActual: project.plannedVsActual,
    selfClaimAllowed: project.selfClaimAllowed,
  });
  const [min, setMin] = useState(project.checklistMin?.toString() ?? "");
  const [max, setMax] = useState(project.checklistMax?.toString() ?? "");
  const canEdit = project.canEditSettings;

  const update = useUpdateProject({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getGetProjectQueryKey(project.id),
          }),
          queryClient.invalidateQueries({
            queryKey: getListProjectsQueryKey(),
          }),
        ]);
      },
      onError: (err) => toast.error(err.message),
    },
  });

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate({
          projectId: project.id,
          data: {
            name: name.trim(),
            ...flags,
            checklistMin: toLimit(min),
            checklistMax: toLimit(max),
          },
        });
      }}
    >
      <label className="flex max-w-md flex-col gap-1.5 text-sm font-medium">
        Name
        <Input
          required
          maxLength={100}
          value={name}
          disabled={!canEdit}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <ul className="divide-y rounded-xl border bg-card">
        {SWITCHES.map((item) => (
          <li key={item.key} className="flex items-center gap-4 px-4 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {item.label}
                {!item.available && (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                    Currently unavailable
                  </span>
                )}
              </span>
              <span className="text-sm text-muted-foreground">
                {item.description}
              </span>
            </span>
            <Switch
              aria-label={item.label}
              checked={flags[item.key]}
              disabled={!canEdit || !item.available}
              onCheckedChange={(checked) =>
                setFlags({ ...flags, [item.key]: checked })
              }
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Fewest checklist entries
          <Input
            type="number"
            min={1}
            className="w-40"
            placeholder="No limit"
            value={min}
            disabled={!canEdit}
            onChange={(event) => setMin(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Most checklist entries
          <Input
            type="number"
            min={1}
            className="w-40"
            placeholder="No limit"
            value={max}
            disabled={!canEdit}
            onChange={(event) => setMax(event.target.value)}
          />
        </label>
      </div>

      {canEdit ? (
        <div>
          <Button type="submit" disabled={update.isPending || !name.trim()}>
            Save
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only owners can change these settings.
        </p>
      )}
    </form>
  );
};

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
