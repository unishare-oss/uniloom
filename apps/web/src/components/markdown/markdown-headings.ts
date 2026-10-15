import GithubSlugger, { slug } from "github-slugger";
import { toString } from "mdast-util-to-string";
import type { Root } from "mdast";
import type { Element } from "hast";
import { visit } from "unist-util-visit";

/** One parse supplies both permalink ids and the optional document contents. */
export const remarkMarkdownHeadings =
  ({ prefix, contents }: { prefix: string; contents: boolean }) =>
  (tree: Root) => {
    const slugger = new GithubSlugger();
    const headings: { id: string; text: string; depth: number }[] = [];
    visit(tree, "heading", (node) => {
      const text = toString(node);
      const id = `${prefix}-${slugger.slug(slug(text) || "section")}`;
      node.data = {
        ...node.data,
        hProperties: { ...node.data?.hProperties, id },
      };
      if (node.depth === 2 || node.depth === 3)
        headings.push({ id, text, depth: node.depth });
    });
    visit(tree, "blockquote", (node) => {
      const first = node.children[0];
      if (first?.type !== "paragraph" || first.children[0]?.type !== "text")
        return;
      const text = first.children[0];
      const marker = text.value.match(
        /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\r?\n|$)/,
      );
      if (!marker) return;
      text.value = text.value.slice(marker[0].length);
      if (!toString(first).trim()) node.children.shift();
      node.data = {
        ...node.data,
        hName: "aside",
        hProperties: {
          "data-callout": marker[1].toLowerCase(),
          className: ["markdown-callout"],
        },
      };
    });
    if (!contents || headings.length < 4) return;
    const entries: Element[] = headings.map((heading) => ({
      type: "element",
      tagName: "li",
      properties: {
        className: heading.depth === 3 ? ["markdown-contents-nested"] : [],
      },
      children: [
        {
          type: "element",
          tagName: "a",
          properties: { href: `#${heading.id}` },
          children: [{ type: "text", value: heading.text }],
        },
      ],
    }));
    tree.children.unshift({
      type: "paragraph",
      children: [],
      data: {
        hName: "nav",
        hProperties: {
          "aria-label": "On this page",
          className: ["markdown-contents"],
        },
        hChildren: [
          {
            type: "element",
            tagName: "details",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "summary",
                properties: {},
                children: [{ type: "text", value: "On this page" }],
              },
              {
                type: "element",
                tagName: "ol",
                properties: {},
                children: entries,
              },
            ],
          },
        ],
      },
    });
  };
