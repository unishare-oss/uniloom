import type { ReactNode } from "react";

/** One numbered step of the guide, linked from the contents list by its id. */
export const GuideSection = ({
  id,
  step,
  title,
  children,
}: {
  id: string;
  step: number;
  title: string;
  children: ReactNode;
}) => {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-6 flex-col gap-3"
    >
      <h2 id={`${id}-title`} className="pt-4 text-lg font-semibold">
        <span className="block font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Step {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
};
