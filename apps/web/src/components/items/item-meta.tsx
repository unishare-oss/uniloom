import {
  CircleDot,
  CornerDownRight,
  GitCommitHorizontal,
  Grid3x3,
  OctagonAlert,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ItemKind = "FEATURE" | "SLICE" | "TASK" | "SUBTASK";
export type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type StateCategory =
  "BACKLOG" | "UNSTARTED" | "STARTED" | "DONE" | "CANCELED";

/** The kinds a mode's items can have, in the order the New item form lists them. */
export const KINDS_BY_MODE: Record<"GUIDED" | "STANDARD", ItemKind[]> = {
  GUIDED: ["FEATURE", "SLICE"],
  STANDARD: ["TASK", "SUBTASK"],
};

const KIND: Record<ItemKind, { label: string; icon: LucideIcon; bg: string }> =
  {
    FEATURE: { label: "Feature", icon: Grid3x3, bg: "bg-feature" },
    SLICE: { label: "Slice", icon: GitCommitHorizontal, bg: "bg-slice" },
    TASK: { label: "Task", icon: CircleDot, bg: "bg-task" },
    SUBTASK: {
      label: "Subtask",
      icon: CornerDownRight,
      bg: "bg-muted-foreground",
    },
  };

export const kindLabel = (kind: ItemKind) => KIND[kind].label;

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

const PRIORITY: Record<
  Priority,
  { label: string; icon: LucideIcon; className: string }
> = {
  URGENT: { label: "Urgent", icon: OctagonAlert, className: "text-urgent" },
  HIGH: { label: "High", icon: SignalHigh, className: "text-foreground" },
  MEDIUM: { label: "Medium", icon: SignalMedium, className: "text-foreground" },
  LOW: { label: "Low", icon: SignalLow, className: "text-foreground" },
  NONE: {
    label: "No priority",
    icon: SignalZero,
    className: "text-muted-foreground",
  },
};

export const PRIORITIES = Object.keys(PRIORITY) as Priority[];
export const priorityLabel = (priority: Priority) => PRIORITY[priority].label;

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

// Guided states by their stable key; Standard states (no key) by category.
const TOP_BY_KEY: Record<string, string> = {
  triage: "border-t-state-waiting",
  backlog: "border-t-state-waiting",
  aligning: "border-t-state-aligning",
  ready: "border-t-state-ready",
  in_progress: "border-t-state-active",
  blocked: "border-t-state-blocked",
  in_review: "border-t-state-review",
  done: "border-t-state-done",
  canceled: "border-t-state-canceled",
};
const TOP_BY_CATEGORY: Record<StateCategory, string> = {
  BACKLOG: "border-t-state-waiting",
  UNSTARTED: "border-t-state-todo",
  STARTED: "border-t-state-active",
  DONE: "border-t-state-done",
  CANCELED: "border-t-state-canceled",
};

/** The colour of a board column's top edge, e.g. red for Blocked, green for Done. */
export const stateTopClass = (state: {
  key: string | null;
  category: StateCategory;
}) => {
  return (
    (state.key && TOP_BY_KEY[state.key]) || TOP_BY_CATEGORY[state.category]
  );
};

export type LabelColor =
  "GRAY" | "RED" | "ORANGE" | "YELLOW" | "GREEN" | "BLUE" | "PURPLE" | "PINK";

// Whole class names, so Tailwind sees them; the colours are `--label-*` in globals.css.
const LABEL_COLOR: Record<LabelColor, { name: string; className: string }> = {
  GRAY: {
    name: "Gray",
    className: "bg-label-gray/15 text-label-gray ring-label-gray/40",
  },
  RED: {
    name: "Red",
    className: "bg-label-red/15 text-label-red ring-label-red/40",
  },
  ORANGE: {
    name: "Orange",
    className: "bg-label-orange/15 text-label-orange ring-label-orange/40",
  },
  YELLOW: {
    name: "Yellow",
    className: "bg-label-yellow/15 text-label-yellow ring-label-yellow/40",
  },
  GREEN: {
    name: "Green",
    className: "bg-label-green/15 text-label-green ring-label-green/40",
  },
  BLUE: {
    name: "Blue",
    className: "bg-label-blue/15 text-label-blue ring-label-blue/40",
  },
  PURPLE: {
    name: "Purple",
    className: "bg-label-purple/15 text-label-purple ring-label-purple/40",
  },
  PINK: {
    name: "Pink",
    className: "bg-label-pink/15 text-label-pink ring-label-pink/40",
  },
};

export const LABEL_COLORS = Object.keys(LABEL_COLOR) as LabelColor[];
export const labelColorName = (color: LabelColor) => LABEL_COLOR[color].name;

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
        "inline-flex h-5 max-w-full items-center rounded-full px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        LABEL_COLOR[color].className,
      )}
    >
      <span className="truncate">{name}</span>
    </span>
  );
};
