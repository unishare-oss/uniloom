import Link from "next/link";
import { StateLozenge } from "@/components/items/state-lozenge";
import type { GetDocument200 } from "@/lib/api/generated/uniloomAPI.schemas";

/** The other direction: the ticket a document belongs to, or the tickets that link to it. */
export const LinkedTickets = ({
  projectId,
  document,
}: {
  projectId: string;
  document: GetDocument200;
}) => {
  if (document.homeItem)
    return (
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground">Ticket</h2>
        <Link
          href={`/p/${projectId}/items/${document.homeItem.id}`}
          className="mt-1 flex gap-2 hover:underline"
        >
          <span className="shrink-0 font-semibold text-muted-foreground">
            {document.homeItem.key}
          </span>
          <span className="min-w-0 truncate">{document.homeItem.title}</span>
        </Link>
      </div>
    );
  return (
    <div>
      <h2 className="text-xs font-semibold text-muted-foreground">
        Linked tickets
      </h2>
      {document.items.length === 0 && <p>None yet.</p>}
      {document.items.map((item) => (
        <Link
          key={item.id}
          href={`/p/${projectId}/items/${item.id}`}
          className="mt-1 flex items-center gap-2 hover:underline"
        >
          <span className="shrink-0 font-semibold text-muted-foreground">
            {item.key}
          </span>
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          <StateLozenge name={item.state.name} category={item.state.category} />
        </Link>
      ))}
    </div>
  );
};
