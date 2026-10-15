import type { ComponentPropsWithoutRef } from "react";
import { LinkIcon } from "lucide-react";

export const MarkdownHeading = ({
  level,
  children,
  id,
  ...props
}: ComponentPropsWithoutRef<"h2"> & { level: 1 | 2 | 3 | 4 | 5 | 6 }) => {
  const Tag = `h${level}` as const;
  return (
    <Tag id={id} {...props}>
      {children}
      {id && (
        <a
          href={`#${id}`}
          className="markdown-heading-link"
          aria-label="Link to this section"
        >
          <LinkIcon aria-hidden="true" size={14} />
        </a>
      )}
    </Tag>
  );
};
