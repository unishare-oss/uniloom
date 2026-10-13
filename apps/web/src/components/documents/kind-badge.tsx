import {
  DOCUMENT_KIND,
  type DocumentKind,
} from "@/components/documents/document-meta";
import { cn } from "@/lib/utils";

/** A document's kind: its coloured icon and label. */
export const KindBadge = ({ kind }: { kind: DocumentKind }) => {
  const { label, icon: Icon, text, bg } = DOCUMENT_KIND[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        text,
        bg,
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
};
