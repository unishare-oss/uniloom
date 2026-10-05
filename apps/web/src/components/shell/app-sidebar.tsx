"use client";

import {
  ChevronLeft,
  Columns3,
  LayoutGrid,
  SquarePlus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Avatar } from "@/components/user/avatar";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { LogoMark } from "@/components/shell/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ProjectChip } from "@/components/projects/project-chip";
import { useGetMe } from "@/lib/api/generated/users/users";
import { useListProjects } from "@/lib/api/generated/projects/projects";

// The active link is a filled block with an ink outline and offset shadow (UniShare's look).
const linkClass =
  "h-11 gap-3.5 rounded-xl border-2 border-transparent px-3 text-[15px] [&_svg]:size-5! data-active:border-ink data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground data-active:shadow-hard hover:data-active:bg-primary hover:data-active:text-primary-foreground";
const labelClass =
  "font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase";

/**
 * Projects, the open project's Board and Trash, the other projects, and the
 * profile. A slide-out sheet on phones (shadcn's Sidebar handles both).
 */
export const AppSidebar = () => {
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId?: string }>();
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const { data: projects } = useListProjects({
    query: { select: (r) => r.data },
  });
  const { data: me } = useGetMe({
    query: { select: (r) => r.data, retry: false },
  });
  const current = projects?.find((w) => w.id === projectId);
  const others = projects?.filter((w) => w.id !== projectId) ?? [];

  // On a phone, close the sheet after following a link.
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);

  return (
    <Sidebar className="group-data-[side=left]:border-r-2 group-data-[side=left]:border-ink">
      <SidebarHeader className="flex-row items-center gap-3 border-b-2 border-border py-3.5 pr-3 pl-4">
        <Link
          href="/"
          aria-label="Uniloom home"
          className="flex size-10 items-center justify-center rounded-[10px] bg-accent text-primary"
        >
          <LogoMark className="size-[22px]" />
        </Link>
        <span className="flex-1 text-lg font-bold tracking-tight text-foreground">
          Uniloom
        </span>
        <button
          type="button"
          aria-label="Collapse sidebar"
          onClick={toggleSidebar}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft className="size-[18px]" />
        </button>
      </SidebarHeader>

      <SidebarContent className="gap-4 px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className={labelClass}>Primary</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                className={linkClass}
                isActive={pathname === "/"}
                render={<Link href="/" />}
              >
                <LayoutGrid />
                <span>Projects</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {current && (
          <SidebarGroup>
            <SidebarGroupLabel className={labelClass}>
              {current.name} · {current.keyPrefix}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={linkClass}
                  isActive={!pathname.endsWith("/trash")}
                  render={<Link href={`/p/${current.id}`} />}
                >
                  <Columns3 />
                  <span>Board</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={linkClass}
                  isActive={pathname.endsWith("/trash")}
                  render={<Link href={`/p/${current.id}/trash`} />}
                >
                  <Trash2 />
                  <span>Trash</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className={labelClass}>
            {current ? "Switch to" : "Your projects"}
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {others.map((project) => (
              <SidebarMenuItem key={project.id}>
                <SidebarMenuButton
                  className={linkClass}
                  render={<Link href={`/p/${project.id}`} />}
                >
                  <ProjectChip keyPrefix={project.keyPrefix} />
                  <span>{project.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <NewProjectDialog
                trigger={
                  <SidebarMenuButton className={linkClass}>
                    <SquarePlus />
                    <span>New project</span>
                  </SidebarMenuButton>
                }
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t-2 border-border p-0">
        <Link
          href="/profile"
          className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted"
        >
          {me && (
            <Avatar
              name={me.name}
              image={me.image}
              size={40}
              className="rounded-[10px]"
            />
          )}
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-foreground">
              {me?.name ?? "Profile"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {me?.email}
            </span>
          </span>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
};
