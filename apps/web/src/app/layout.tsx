import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthBootstrap } from "@/components/auth/auth-bootstrap";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uniloom",
  description:
    "A design-first work tracker for building software with a coding agent",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>
          <AuthBootstrap />
          {children}
        </Providers>
      </body>
    </html>
  );
}
