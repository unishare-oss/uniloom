import { AppShell } from "@/components/shell/app-shell";
import { WorkspaceList } from "@/components/workspaces/workspace-list";

/** Your workspaces. Signed-out visitors are sent to `/welcome` (see proxy.ts). */
const Home = () => {
  return (
    <AppShell>
      <WorkspaceList />
    </AppShell>
  );
};

export default Home;
