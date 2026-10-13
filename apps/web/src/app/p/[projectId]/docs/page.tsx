import { KnowledgePage } from "@/components/documents/knowledge-page";

const DocsPage = async ({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) => {
  const { projectId } = await params;
  return <KnowledgePage projectId={projectId} />;
};

export default DocsPage;
