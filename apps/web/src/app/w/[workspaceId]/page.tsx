import { Board } from "@/components/board/board";

const BoardPage = async ({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) => {
  const { workspaceId } = await params;
  return <Board workspaceId={workspaceId} />;
};

export default BoardPage;
