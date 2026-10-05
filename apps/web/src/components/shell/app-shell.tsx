"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { LogoMark } from "@/components/shell/logo";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

/** On a phone a top bar opens the sidebar; on a desktop a button brings it back once hidden. */
const OpenSidebar = () => {
  const { state } = useSidebar();
  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b px-3 md:hidden">
        <SidebarTrigger aria-label="Open menu" />
        <LogoMark className="size-5 text-primary" />
        <span className="font-bold">Uniloom</span>
      </div>
      {state === "collapsed" && (
        <SidebarTrigger
          aria-label="Show sidebar"
          className="absolute top-4 left-2 z-10 hidden md:inline-flex"
        />
      )}
    </>
  );
};

/** Every signed-in page: the sidebar and the page next to it. */
export const AppShell = ({ children }: { children: ReactNode }) => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <OpenSidebar />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};
