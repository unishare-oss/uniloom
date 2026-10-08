import { Suspense } from "react";
import { Board } from "@/components/board/board";

const BoardPage = async ({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) => {
  const { projectId } = await params;
  return (
    <Suspense>
      <Board projectId={projectId} />
    </Suspense>
  );
};

export default BoardPage;
