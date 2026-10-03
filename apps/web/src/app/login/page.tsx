"use client";

import dynamic from "next/dynamic";

// The screen reads cookies and window while rendering, so it runs in the browser only.
const Login = dynamic(() => import("./login"), { ssr: false });

export default function LoginPage() {
  return <Login />;
}
