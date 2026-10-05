import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";

const ProjectLayout = ({ children }: { children: ReactNode }) => {
  return <AppShell>{children}</AppShell>;
};

export default ProjectLayout;
