import Link from "next/link";
import { KindBadge } from "@/components/documents/kind-badge";
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
          {document.title}
        </Link>
        {archived && (
          <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">
            Archived
          </span>
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
