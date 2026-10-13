"use client";

import dynamic from "next/dynamic";
import { AppShell } from "@/components/shell/app-shell";

// The screen reads window.location while rendering, so it runs in the browser only.
const ConnectAgent = dynamic(() => import("@/components/agent/connect-agent"), {
  ssr: false,
});

const ProfileAgentPage = () => {
  return (
    <AppShell>
      <ConnectAgent />
    </AppShell>
  );
};

export default ProfileAgentPage;
