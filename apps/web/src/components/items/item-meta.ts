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

export type ItemKind = "FEATURE" | "SLICE" | "TASK" | "SUBTASK";
export type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type StateCategory =
  "BACKLOG" | "UNSTARTED" | "STARTED" | "DONE" | "CANCELED";

/** The kinds a mode's items can have, in the order the New item form lists them. */
export const KINDS_BY_MODE: Record<"GUIDED" | "STANDARD", ItemKind[]> = {
  GUIDED: ["FEATURE", "SLICE"],
  STANDARD: ["TASK", "SUBTASK"],
};

export const KIND: Record<
  ItemKind,
  { label: string; icon: LucideIcon; bg: string }
> = {
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

export const PRIORITY: Record<
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
export const LABEL_COLOR: Record<
  LabelColor,
  { name: string; className: string; dot: string }
> = {
  GRAY: {
    name: "Gray",
    className: "bg-label-gray/15 text-label-gray ring-label-gray/40",
    dot: "bg-label-gray",
  },
  RED: {
    name: "Red",
    className: "bg-label-red/15 text-label-red ring-label-red/40",
    dot: "bg-label-red",
  },
  ORANGE: {
    name: "Orange",
    className: "bg-label-orange/15 text-label-orange ring-label-orange/40",
    dot: "bg-label-orange",
  },
  YELLOW: {
    name: "Yellow",
    className: "bg-label-yellow/15 text-label-yellow ring-label-yellow/40",
    dot: "bg-label-yellow",
  },
  GREEN: {
    name: "Green",
    className: "bg-label-green/15 text-label-green ring-label-green/40",
    dot: "bg-label-green",
  },
  BLUE: {
    name: "Blue",
    className: "bg-label-blue/15 text-label-blue ring-label-blue/40",
    dot: "bg-label-blue",
  },
  PURPLE: {
    name: "Purple",
    className: "bg-label-purple/15 text-label-purple ring-label-purple/40",
    dot: "bg-label-purple",
  },
  PINK: {
    name: "Pink",
    className: "bg-label-pink/15 text-label-pink ring-label-pink/40",
    dot: "bg-label-pink",
  },
};

export const LABEL_COLORS = Object.keys(LABEL_COLOR) as LabelColor[];
export const labelColorName = (color: LabelColor) => LABEL_COLOR[color].name;
