"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/** Toasts in the same light or dark as the page. */
export const ThemedToaster = () => {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      richColors
      position="top-center"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
};
