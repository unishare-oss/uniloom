"use client";

import { LogoMark } from "@/components/shell/logo";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

/** On a phone a top bar opens the sidebar; on a desktop a button brings it back once hidden. */
export const OpenSidebar = () => {
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
