import { PRIORITY, type Priority } from "@/components/items/item-meta";
import { cn } from "@/lib/utils";

/** Signal bars (High = 3 … Low = 1), or a red octagon for Urgent. */
export const PriorityIcon = ({ priority }: { priority: Priority }) => {
  const { label, icon: Icon, className } = PRIORITY[priority];
  return (
    <Icon
      role="img"
      aria-label={label}
      className={cn("size-4 shrink-0", className)}
    />
  );
};
