import {
  BookOpen,
  FileText,
  Lightbulb,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

export type DocumentKind = "BRIEF" | "PROPOSAL" | "SPEC" | "REFERENCE";

export const DOCUMENT_KINDS: DocumentKind[] = [
  "BRIEF",
  "PROPOSAL",
  "SPEC",
  "REFERENCE",
];

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
};
