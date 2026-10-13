import { DocumentRow } from "@/components/documents/document-row";
import type { ListDocuments200Item } from "@/lib/api/generated/uniloomAPI.schemas";

/** The library's table. */
export const DocumentList = ({
  projectId,
  documents,
}: {
  projectId: string;
  documents: ListDocuments200Item[];
}) => {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Kind</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Author</th>
            <th className="px-4 py-3 font-medium">Last edited</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              projectId={projectId}
              document={document}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
