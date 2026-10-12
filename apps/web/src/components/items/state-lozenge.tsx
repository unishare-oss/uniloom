import {
  stateTintClass,
  type StateCategory,
} from "@/components/items/item-meta";
import { cn } from "@/lib/utils";

/**
 * A state as an uppercase lozenge in its board colour (the same colour as its column's
 * top edge): Guided states by key, so In Review is amber, others by category. Without a
 * category (e.g. the board's mode badge) it is neutral.
 */
export const StateLozenge = ({
  name,
  category,
  stateKey,
}: {
  name: string;
  category?: StateCategory;
  stateKey?: string | null;
}) => {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[4px] px-1.5 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase",
        category
          ? stateTintClass({ key: stateKey ?? null, category })
          : "bg-secondary text-secondary-foreground ring-1 ring-border ring-inset",
      )}
    >
      {name}
    </span>
  );
};
