"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/user/avatar";
import { successMessage } from "@/lib/api/fetcher";
import {
  getListMembersQueryKey,
  useAddMember,
  useChangeMemberRole,
  useListMembers,
  useRemoveMember,
} from "@/lib/api/generated/members/members";
import { useGetMe } from "@/lib/api/generated/users/users";
import {
  getGetProjectQueryKey,
  getListProjectsQueryKey,
  useGetProject,
} from "@/lib/api/generated/projects/projects";
import {
  RoleSelect,
  roleLabels,
  type Role,
} from "@/components/members/role-select";

/**
 * Who is in the project and with which role. Owners add, change and remove; managers
 * add people as Member. What each may do comes from the project's flags.
 */
export const MembersPage = ({ projectId }: { projectId: string }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const { data: members, error } = useListMembers(projectId, {
    query: { select: (r) => r.data },
  });
  const { data: project } = useGetProject(projectId, {
    query: { select: (r) => r.data },
  });
  const { data: me } = useGetMe({ query: { select: (r) => r.data } });

  const refreshMembers = () =>
    queryClient.invalidateQueries({
      queryKey: getListMembersQueryKey(projectId),
    });
  const onError = (err: Error) => toast.error(err.message);

  const add = useAddMember({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        setEmail("");
        await refreshMembers();
      },
      onError,
    },
  });
  const change = useChangeMemberRole({
    mutation: {
      onSuccess: async (res) => {
        toast.success(successMessage(res));
        // Your own role may have changed, and with it what you can do here.
        await Promise.all([
          refreshMembers(),
          queryClient.invalidateQueries({
            queryKey: getGetProjectQueryKey(projectId),
          }),
        ]);
      },
      onError,
    },
  });
  const remove = useRemoveMember({
    mutation: {
      onSuccess: async (res, vars) => {
        toast.success(successMessage(res));
        if (vars.userId === me?.id) {
          await queryClient.invalidateQueries({
            queryKey: getListProjectsQueryKey(),
          });
          router.push("/");
          return;
        }
        await refreshMembers();
      },
      onError,
    },
  });

  const canManage = project?.canManageMembers ?? false;
  const assignable = project?.assignableRoles ?? [];
  const busy = add.isPending || change.isPending || remove.isPending;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground">
          Who belongs to this project and what each person can do.
        </p>
      </div>

      {assignable.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate({
              projectId,
              data: {
                email: email.trim(),
                role: assignable.includes(role) ? role : assignable[0]!,
              },
            });
          }}
        >
          <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-medium">
            Email of someone with a Uniloom account
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </label>
          {assignable.length > 1 ? (
            <RoleSelect
              value={role}
              roles={assignable}
              onChange={setRole}
              label="Role to add"
            />
          ) : (
            <span className="flex h-9 items-center px-3 text-sm">
              {roleLabels[assignable[0]!]}
            </span>
          )}
          <Button type="submit" disabled={busy || !email.trim()}>
            <UserPlus />
            Add
          </Button>
        </form>
      )}

      {error && <p role="alert">{error.message}</p>}
      {!members && !error && <Skeleton className="h-40 w-full rounded-xl" />}

      {members && (
        <ul className="divide-y rounded-xl border bg-card">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <Avatar name={member.name} image={member.image} size={36} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {member.name}
                  {member.userId === me?.id && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      you
                    </span>
                  )}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {member.email}
                </span>
              </span>
              {canManage ? (
                <RoleSelect
                  value={member.role}
                  roles={assignable}
                  label={`Role of ${member.name}`}
                  disabled={busy}
                  onChange={(next) =>
                    change.mutate({
                      projectId,
                      userId: member.userId,
                      data: { role: next },
                    })
                  }
                />
              ) : (
                <span className="text-sm">{roleLabels[member.role]}</span>
              )}
              {canManage && member.userId !== me?.id && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    remove.mutate({ projectId, userId: member.userId })
                  }
                >
                  <X />
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {me && (
        <div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => remove.mutate({ projectId, userId: me.id })}
          >
            <LogOut />
            Leave project
          </Button>
        </div>
      )}
    </main>
  );
};
