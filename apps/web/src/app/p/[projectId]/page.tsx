import { Board } from "@/components/board/board";

const BoardPage = async ({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) => {
  const { projectId } = await params;
  return <Board projectId={projectId} />;
};

export default BoardPage;
