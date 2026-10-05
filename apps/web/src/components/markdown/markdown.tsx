import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "@/components/markdown/mermaid";

const components: Components = {
  // A ```mermaid code block becomes a diagram; any other code block stays code.
  pre({ node, ...props }) {
    const code = node?.children[0];
    if (
      code?.type === "element" &&
      code.tagName === "code" &&
      Array.isArray(code.properties.className) &&
      code.properties.className.includes("language-mermaid")
    ) {
      const chart = code.children
        .map((child) => (child.type === "text" ? child.value : ""))
        .join("");
      return <Mermaid chart={chart} />;
    }
    return <pre {...props} />;
  },
};

/**
 * Markdown with GitHub's extras (tables, task lists, strikethrough) and Mermaid diagrams.
 * Raw HTML in the text is shown as text, never run.
 */
export const Markdown = ({ children }: { children: string }) => {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
};
