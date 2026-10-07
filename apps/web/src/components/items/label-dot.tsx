import { LABEL_COLOR, type LabelColor } from "@/components/items/item-meta";
import { cn } from "@/lib/utils";

/** A label's colour as a small square, for menu rows where a full chip is too loud. */
export const LabelDot = ({ color }: { color: LabelColor }) => {
  return (
    <span
      aria-hidden
      className={cn("size-2.5 shrink-0 rounded-[2px]", LABEL_COLOR[color].dot)}
    />
  );
};
