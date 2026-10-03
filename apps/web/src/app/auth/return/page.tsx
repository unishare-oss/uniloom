"use client";

import { useEffect, useRef } from "react";
import { takeReturnTo } from "@/lib/uniauth";

/** uniAuth errors land here. login_required = not signed in there: carry on signed out. */
export default function AuthReturnPage() {
  // Once only: takeReturnTo clears the stored URL, so a second run (React Strict Mode runs
  // effects twice in dev) would redirect to / over the first redirect.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const error = new URLSearchParams(window.location.search).get("error");
    const returnTo = takeReturnTo() ?? "/";
    if (!error || error === "login_required") window.location.replace(returnTo);
    else window.location.replace(`/login?error=${encodeURIComponent(error)}`);
  }, []);
  return null;
}
