"use client";

import dynamic from "next/dynamic";

// The screen reads window while rendering, so it runs in the browser only.
const Consent = dynamic(() => import("./consent"), { ssr: false });

export default function ConsentPage() {
  return <Consent />;
}
