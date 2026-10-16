import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** A page section that starts open; clicking its heading hides or shows the content. */
export const CollapsibleSection = ({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: ReactNode;
  count: number;
  children: ReactNode;
}) => {
  return (
    <details open className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-90" />
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {count}
        </span>
      </summary>
      {children}
    </details>
  );
};
