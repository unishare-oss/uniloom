"use client";

import dynamic from "next/dynamic";

// The screen reads window while rendering, so it runs in the browser only.
const Consent = dynamic(() => import("@/components/auth/consent"), {
  ssr: false,
});

const ConsentPage = () => {
  return <Consent />;
};

export default ConsentPage;
