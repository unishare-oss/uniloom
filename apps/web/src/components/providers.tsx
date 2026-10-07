"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { ThemedToaster } from "@/components/themed-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

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
