"use client";

import dynamic from "next/dynamic";

// The screen reads cookies and window while rendering, so it runs in the browser only.
const Login = dynamic(() => import("@/components/auth/login"), { ssr: false });

const LoginPage = () => {
  return <Login />;
};

export default LoginPage;
