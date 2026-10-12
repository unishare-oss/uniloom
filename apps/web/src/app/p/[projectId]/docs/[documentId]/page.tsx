import { DocumentView } from "@/components/documents/document-view";

const DocumentPage = async ({
  params,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
}) => {
  const { projectId, documentId } = await params;
  return <DocumentView projectId={projectId} documentId={documentId} />;
};

export default DocumentPage;
