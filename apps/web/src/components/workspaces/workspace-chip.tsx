import { cn } from "@/lib/utils";

// The same key always gets the same colour (the theme's chart colours), so a workspace is
// easy to spot.
const COLOURS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

const colourFor = (key: string) => {
  const sum = [...key].reduce((total, char) => total + char.charCodeAt(0), 0);
  return COLOURS[sum % COLOURS.length];
};

/** A workspace's key prefix (UL) on its colour. */
export const WorkspaceChip = ({
  keyPrefix,
  className,
}: {
  keyPrefix: string;
  className?: string;
}) => {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-[22px] shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-background",
        colourFor(keyPrefix),
        className,
      )}
    >
      {keyPrefix}
    </span>
  );
};
