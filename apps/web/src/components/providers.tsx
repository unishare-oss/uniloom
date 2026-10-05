"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Toasts in the same light or dark as the page. */
const ThemedToaster = () => {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      richColors
      position="top-center"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
};

/**
 * App-wide client state: light/dark (follows the system unless the user picks one on
 * /profile), TanStack Query's cache, tooltips and toasts.
 */
export const Providers = ({ children }: { children: ReactNode }) => {
  // One client per browser tab, created once.
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
};
