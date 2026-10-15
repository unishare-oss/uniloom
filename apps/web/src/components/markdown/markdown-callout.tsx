import type { ComponentPropsWithoutRef } from "react";
import {
  Info,
  Lightbulb,
  MessageSquareWarning,
  TriangleAlert,
  OctagonAlert,
} from "lucide-react";

const callouts = {
  note: { title: "Note", icon: Info },
  tip: { title: "Tip", icon: Lightbulb },
  important: { title: "Important", icon: MessageSquareWarning },
  warning: { title: "Warning", icon: TriangleAlert },
  caution: { title: "Caution", icon: OctagonAlert },
};

export const MarkdownCallout = ({
  children,
  kind,
  ...props
}: ComponentPropsWithoutRef<"aside"> & { kind: string }) => {
  const { title, icon: Icon } =
    callouts[kind as keyof typeof callouts] ?? callouts.note;
  return (
    <aside {...props} data-callout={kind} aria-label={title}>
      <p className="markdown-callout-title">
        <Icon size={16} aria-hidden="true" />
        {title}
      </p>
      {children}
    </aside>
  );
};
