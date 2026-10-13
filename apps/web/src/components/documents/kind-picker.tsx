import {
  DOCUMENT_KIND,
  type DocumentKind,
} from "@/components/documents/document-meta";
import { cn } from "@/lib/utils";

/** One card per kind the project allows, each with a one-line hint. */
export const KindPicker = ({
  kinds,
  value,
  onChange,
}: {
  kinds: DocumentKind[];
  value: DocumentKind;
  onChange: (kind: DocumentKind) => void;
}) => {
  return (
    <div
      role="radiogroup"
      aria-label="Kind"
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        kinds.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {kinds.map((kind) => {
        const { label, hint, icon: Icon, text, bg } = DOCUMENT_KIND[kind];
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={value === kind}
            onClick={() => onChange(kind)}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-xl border bg-card p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              value === kind ? "border-ink shadow-hard" : "hover:bg-muted/50",
            )}
          >
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-sm font-semibold",
                text,
              )}
            >
              <span className={cn("rounded-md p-1", bg)}>
                <Icon className="size-4" />
              </span>
              {label}
            </span>
            <span className="text-xs text-muted-foreground">{hint}</span>
          </button>
        );
      })}
    </div>
  );
};
