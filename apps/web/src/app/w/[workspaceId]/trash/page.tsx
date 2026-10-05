import { Trash } from "@/components/items/trash";

const TrashPage = async ({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) => {
  const { workspaceId } = await params;
  return <Trash workspaceId={workspaceId} />;
};

export default TrashPage;
