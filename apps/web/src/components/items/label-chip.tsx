import { LABEL_COLOR, type LabelColor } from "@/components/items/item-meta";
import { cn } from "@/lib/utils";

/** A label as a small rounded chip in its colour. */
export const LabelChip = ({
  name,
  color,
}: {
  name: string;
  color: LabelColor;
}) => {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center rounded-[3px] px-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        LABEL_COLOR[color].className,
      )}
    >
      <span className="truncate">{name}</span>
    </span>
  );
};
