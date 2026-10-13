import {
  BookOpen,
  FileText,
  Scale,
  Lightbulb,
  ScrollText,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type DocumentKind =
  "BRIEF" | "PROPOSAL" | "SPEC" | "REFERENCE" | "ADR" | "TECH_DEBT";

export const DOCUMENT_KINDS: DocumentKind[] = [
  "BRIEF",
  "PROPOSAL",
  "SPEC",
  "REFERENCE",
  "ADR",
  "TECH_DEBT",
];

/** How a numbered record is named: ADR-7, TD-3. Other kinds have no number. */
export const documentKey = (kind: DocumentKind, number: number | null) => {
  if (number === null) return null;
  if (kind === "ADR") return `ADR-${number}`;
  if (kind === "TECH_DEBT") return `TD-${number}`;
  return null;
};

export const DOCUMENT_KIND: Record<
  DocumentKind,
  { label: string; hint: string; icon: LucideIcon; text: string; bg: string }
> = {
  BRIEF: {
    label: "Brief",
    hint: "What we build and why, in a page.",
    icon: FileText,
    text: "text-feature",
    bg: "bg-feature/10",
  },
  PROPOSAL: {
    label: "Proposal",
    hint: "A change to agree on before work starts.",
    icon: Lightbulb,
    text: "text-label-orange",
    bg: "bg-label-orange/10",
  },
  SPEC: {
    label: "Spec",
    hint: "How something behaves, precisely.",
    icon: ScrollText,
    text: "text-slice",
    bg: "bg-slice/10",
  },
  REFERENCE: {
    label: "Reference",
    hint: "Notes to look up: architecture, tech stack.",
    icon: BookOpen,
    text: "text-label-blue",
    bg: "bg-label-blue/10",
  },
  ADR: {
    label: "ADR",
    hint: "A decision with its context, options and consequences.",
    icon: Scale,
    text: "text-label-purple",
    bg: "bg-label-purple/10",
  },
  TECH_DEBT: {
    label: "Tech debt",
    hint: "A shortcut or problem to fix later, found while working.",
    icon: Wrench,
    text: "text-label-red",
    bg: "bg-label-red/10",
  },
};
