"use client";

import dynamic from "next/dynamic";

// The screen reads window while rendering, so it runs in the browser only.
const Profile = dynamic(() => import("./profile"), { ssr: false });

export default function ProfilePage() {
  return <Profile />;
}
