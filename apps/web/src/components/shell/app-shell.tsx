"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { OpenSidebar } from "@/components/shell/open-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

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
