import { UserRound } from "lucide-react";

/** The spot an avatar would fill when nobody is assigned: same shape, dashed and muted. */
export const EmptyAvatar = ({ size = 20 }: { size?: number }) => {
  return (
    <span
      aria-hidden
      title="Unassigned"
      className="inline-flex shrink-0 items-center justify-center rounded-[25%] border border-dashed border-muted-foreground/50 text-muted-foreground/70"
      style={{ width: size, height: size }}
    >
      <UserRound style={{ width: size * 0.6, height: size * 0.6 }} />
    </span>
  );
};
