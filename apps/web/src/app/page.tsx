import { AppShell } from "@/components/shell/app-shell";
import { ProjectList } from "@/components/projects/project-list";

/** Your projects. Signed-out visitors are sent to `/welcome` (see proxy.ts). */
const Home = () => {
  return (
    <AppShell>
      <ProjectList />
    </AppShell>
  );
};

export default Home;
