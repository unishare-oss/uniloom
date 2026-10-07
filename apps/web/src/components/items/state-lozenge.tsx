import type { StateCategory } from "@/components/items/item-meta";
import { cn } from "@/lib/utils";

/** A state as an uppercase lozenge, coloured by its category. */
export const StateLozenge = ({
  name,
  category,
}: {
  name: string;
  category?: StateCategory;
}) => {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[3px] px-1.5 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase",
        category === "STARTED" && "bg-accent text-accent-foreground",
        category === "DONE" && "bg-done text-done-foreground",
        category !== "STARTED" &&
          category !== "DONE" &&
          "bg-secondary text-secondary-foreground ring-1 ring-border ring-inset",
      )}
    >
      {name}
    </span>
  );
};
