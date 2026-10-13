import Link from "next/link";
import { documentKey } from "@/components/documents/document-meta";
import { KindBadge } from "@/components/documents/kind-badge";
import { StatusBadge } from "@/components/documents/status-badge";
import type { ListDocuments200Item } from "@/lib/api/generated/uniloomAPI.schemas";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

/** One row of the library: kind, title with its purpose, author, last edit. */
export const DocumentRow = ({
  projectId,
  document,
}: {
  projectId: string;
  document: ListDocuments200Item;
}) => {
  const archived = document.archivedAt !== null;
  const key = documentKey(document.kind, document.number);
  return (
    <tr
      className={cn(
        "border-b last:border-0 hover:bg-muted/50",
        archived && "text-muted-foreground",
      )}
    >
      <td className="px-4 py-3 align-top">
        <KindBadge kind={document.kind} />
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/p/${projectId}/docs/${document.id}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {key && `${key} `}
          {document.title}
        </Link>
        {document.status && (
          <span className="ml-2">
            <StatusBadge status={document.status} />
          </span>
        )}
        {archived && (
          <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">
            Archived
          </span>
        )}
        {document.homeItemId && (
          <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">
            Ticket document
          </span>
        )}
        {document.kind === "TECH_DEBT" && (
          <p className="mt-0.5 text-muted-foreground">
            {document.createdFrom && (
              <>
                Raised on{" "}
                <Link
                  href={`/p/${projectId}/items/${document.createdFrom.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {document.createdFrom.key}
                </Link>
              </>
            )}
            {document.createdFrom && document.fixedBy && " · "}
            {document.fixedBy && (
              <>
                Fixed by{" "}
                <Link
                  href={`/p/${projectId}/items/${document.fixedBy.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {document.fixedBy.key}
                </Link>
              </>
            )}
          </p>
        )}
        {document.purpose && (
          <p className="mt-0.5 line-clamp-1 text-muted-foreground">
            {document.purpose}
          </p>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        {document.author?.name ?? "Unknown"}
      </td>
      <td className="px-4 py-3 align-top whitespace-nowrap text-muted-foreground">
        {timeAgo(document.updatedAt)}
      </td>
    </tr>
  );
};
