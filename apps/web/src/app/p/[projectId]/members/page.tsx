import { MembersPage } from "@/components/members/members-page";

const Page = async ({ params }: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await params;
  return <MembersPage projectId={projectId} />;
};

export default Page;
