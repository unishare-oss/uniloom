import { cn } from "@/lib/utils";

const STATUS = {
  PROPOSED: { label: "Proposed", tone: "bg-label-yellow/15 text-label-yellow" },
  ACCEPTED: { label: "Accepted", tone: "bg-label-green/15 text-label-green" },
  REJECTED: { label: "Rejected", tone: "bg-label-red/15 text-label-red" },
  SUPERSEDED: { label: "Superseded", tone: "bg-label-gray/15 text-label-gray" },
  OPEN: { label: "Open", tone: "bg-label-orange/15 text-label-orange" },
  FIXED: { label: "Fixed", tone: "bg-label-green/15 text-label-green" },
  WONT_FIX: { label: "Won't fix", tone: "bg-label-gray/15 text-label-gray" },
} as const;

/** A document's status as a coloured lozenge: ADR or tech debt. */
export const StatusBadge = ({ status }: { status: keyof typeof STATUS }) => {
  const { label, tone } = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[4px] px-1.5 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase",
        tone,
      )}
    >
      {label}
    </span>
  );
};
