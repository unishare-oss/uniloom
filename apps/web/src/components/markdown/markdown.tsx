"use client";

import { useId } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "@/components/markdown/mermaid";
import { MarkdownHeading } from "./markdown-heading";
import { MarkdownCallout } from "./markdown-callout";
import { MarkdownCodeBlock } from "./markdown-code-block";
import { remarkMarkdownHeadings } from "./markdown-headings";
import { rehypeMarkdownHighlight } from "./markdown-highlight";

const components: Components = {
  h1: ({ node, ...props }) => (
    <MarkdownHeading
      level={1}
      {...props}
      id={node?.properties.id ? String(node.properties.id) : undefined}
    />
  ),
  h2: ({ node, ...props }) => (
    <MarkdownHeading
      level={2}
      {...props}
      id={node?.properties.id ? String(node.properties.id) : undefined}
    />
  ),
  h3: ({ node, ...props }) => (
    <MarkdownHeading
      level={3}
      {...props}
      id={node?.properties.id ? String(node.properties.id) : undefined}
    />
  ),
  h4: ({ node, ...props }) => (
    <MarkdownHeading
      level={4}
      {...props}
      id={node?.properties.id ? String(node.properties.id) : undefined}
    />
  ),
  h5: ({ node, ...props }) => (
    <MarkdownHeading
      level={5}
      {...props}
      id={node?.properties.id ? String(node.properties.id) : undefined}
    />
  ),
  h6: ({ node, ...props }) => (
    <MarkdownHeading
      level={6}
      {...props}
      id={node?.properties.id ? String(node.properties.id) : undefined}
    />
  ),
  aside: ({ node, ...props }) => (
    <MarkdownCallout
      kind={String(node?.properties["data-callout"] ?? "note")}
      {...props}
    />
  ),
  pre: ({ node, ...props }) => {
    const code = node?.children[0];
    if (code?.type !== "element" || code.tagName !== "code")
      return <pre {...props} />;
    const classes = code.properties.className;
    const language = Array.isArray(classes)
      ? String(
          classes.find((name) => String(name).startsWith("language-")) ?? "",
        ).slice(9)
      : "";
    const source = String(code.data?.rawCode ?? "");
    if (language === "mermaid") return <Mermaid chart={source} />;
    return (
      <MarkdownCodeBlock key={source} code={source} language={language}>
        {props.children}
      </MarkdownCodeBlock>
    );
  },
};

/** GFM, callouts and diagrams; raw HTML stays text, never executable markup. */
export const Markdown = ({
  children,
  contents = false,
  headingPrefix,
}: {
  children: string;
  contents?: boolean;
  headingPrefix?: string;
}) => {
  const instance = useId();
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          [
            remarkMarkdownHeadings,
            {
              prefix:
                headingPrefix ??
                `md-${instance.replace(/[^a-zA-Z0-9_-]/g, "")}`,
              contents,
            },
          ],
        ]}
        rehypePlugins={[rehypeMarkdownHighlight]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};
