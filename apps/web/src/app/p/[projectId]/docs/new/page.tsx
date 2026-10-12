import { DocumentEditor } from "@/components/documents/document-editor";

const NewDocumentPage = async ({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) => {
  const { projectId } = await params;
  return <DocumentEditor projectId={projectId} />;
};

export default NewDocumentPage;
