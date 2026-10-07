import type { LabelColor } from "@/components/items/item-meta";
import { LabelDot } from "@/components/items/label-dot";

/** A label as a quiet outlined tag: neutral border and text, only the square is coloured. */
export const LabelTag = ({
  name,
  color,
}: {
  name: string;
  color: LabelColor;
}) => {
  return (
    <span className="inline-flex h-5 max-w-full items-center gap-1 rounded-[3px] border bg-background px-1.5 text-xs text-muted-foreground">
      <LabelDot color={color} />
      <span className="truncate">{name}</span>
    </span>
  );
};
