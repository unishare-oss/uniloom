import { SettingsPage } from "@/components/projects/settings-page";

const Page = async ({ params }: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await params;
  return <SettingsPage projectId={projectId} />;
};

export default Page;
