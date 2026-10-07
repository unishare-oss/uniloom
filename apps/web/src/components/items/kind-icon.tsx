import { KIND, type ItemKind } from "@/components/items/item-meta";
import { cn } from "@/lib/utils";

/** A white glyph on the kind's colour, e.g. a teal thread for a slice. */
export const KindIcon = ({ kind }: { kind: ItemKind }) => {
  const { label, icon: Icon, bg } = KIND[kind];
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] text-white",
        bg,
      )}
    >
      <Icon className="size-3" strokeWidth={2.5} />
    </span>
  );
};
