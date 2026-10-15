import Link from "next/link";
import type { GetDocument200 } from "@/lib/api/generated/uniloomAPI.schemas";

/** Source and inverse links use the API's authorized document summaries. */
export const DocumentProvenance = ({
  projectId,
  document,
}: {
  projectId: string;
  document: GetDocument200;
}) => (
  <>
    {document.sourceProposal && (
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground">
          Based on proposal
        </h2>
        <Link
          href={`/p/${projectId}/docs/${document.sourceProposal.id}`}
          className="break-words hover:underline"
        >
          {document.sourceProposal.title}
        </Link>
        {document.sourceProposal.archivedAt && (
          <span className="ml-1 text-muted-foreground">(archived)</span>
        )}
      </div>
    )}
    {document.kind === "PROPOSAL" && (
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground">
          Derived specs
        </h2>
        {document.derivedSpecs.length === 0 ? (
          <p className="text-muted-foreground">
            No specs based on this proposal yet.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-2">
            {document.derivedSpecs.map((spec) => (
              <li key={spec.id}>
                <Link
                  href={`/p/${projectId}/docs/${spec.id}`}
                  className="break-words hover:underline"
                >
                  {spec.title}
                </Link>
                {spec.homeItem && (
                  <Link
                    href={`/p/${projectId}/items/${spec.homeItem.id}`}
                    className="ml-1 text-xs text-muted-foreground hover:underline"
                  >
                    {spec.homeItem.key}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    )}
  </>
);
