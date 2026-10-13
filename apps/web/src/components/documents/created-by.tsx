import Link from "next/link";
import { Avatar } from "@/components/user/avatar";
import type { GetDocument200 } from "@/lib/api/generated/uniloomAPI.schemas";
import { formatDate } from "@/lib/time";

/** The page's last line: "Created by NAME from TICKET-KEY" and the date. */
export const CreatedBy = ({
  projectId,
  document,
}: {
  projectId: string;
  document: GetDocument200;
}) => {
  return (
    <p className="flex flex-wrap items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
      {document.author && (
        <Avatar
          name={document.author.name}
          image={document.author.image}
          size={20}
        />
      )}
      <span>
        Created by {document.author?.name ?? "an unknown person"}
        {document.createdFrom && (
          <>
            {" "}
            from{" "}
            <Link
              href={`/p/${projectId}/items/${document.createdFrom.id}`}
              className="font-semibold text-foreground hover:underline"
            >
              {document.createdFrom.key}
            </Link>
          </>
        )}{" "}
        on {formatDate(document.createdAt)}
      </span>
    </p>
  );
};
