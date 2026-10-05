import { AppShell } from "@/components/shell/app-shell";
import { WorkspaceList } from "@/components/workspaces/workspace-list";

/** Your workspaces. Signed-out visitors get the landing page instead (see proxy.ts). */
const Home = () => {
  return (
    <AppShell>
      <WorkspaceList />
    </AppShell>
  );
};

export default Home;
