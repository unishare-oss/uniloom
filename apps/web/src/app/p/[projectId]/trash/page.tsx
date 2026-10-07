import { Trash } from "@/components/items/trash";

const TrashPage = async ({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) => {
  const { projectId } = await params;
  return <Trash projectId={projectId} />;
};

export default TrashPage;
