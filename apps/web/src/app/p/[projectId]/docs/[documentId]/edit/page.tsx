import { DocumentEditor } from "@/components/documents/document-editor";

const EditDocumentPage = async ({
  params,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
}) => {
  const { projectId, documentId } = await params;
  return <DocumentEditor projectId={projectId} documentId={documentId} />;
};

export default EditDocumentPage;
