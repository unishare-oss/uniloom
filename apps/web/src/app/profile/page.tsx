"use client";

import dynamic from "next/dynamic";
import { AppShell } from "@/components/shell/app-shell";

// The screen reads window while rendering, so it runs in the browser only.
const Profile = dynamic(() => import("@/components/user/profile"), {
  ssr: false,
});

const ProfilePage = () => {
  return (
    <AppShell>
      <Profile />
    </AppShell>
  );
};

export default ProfilePage;
