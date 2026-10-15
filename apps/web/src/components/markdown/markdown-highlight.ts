import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import markdown from "highlight.js/lib/languages/markdown";
import type { Root } from "hast";
import { visit } from "unist-util-visit";

declare module "hast" {
  interface ElementData {
    rawCode?: string;
  }
}

const lowlight = createLowlight({
  javascript,
  typescript,
  json,
  bash,
  sql,
  css,
  xml,
  markdown,
});
lowlight.registerAlias({
  javascript: ["js", "jsx"],
  typescript: ["ts", "tsx"],
  bash: ["shell", "sh"],
  xml: ["html"],
});

/** Highlight only explicit, supported fenced languages; preserve source for copy. */
export const rehypeMarkdownHighlight = () => (tree: Root) => {
  visit(tree, "element", (node) => {
    if (node.tagName !== "pre") return;
    const code = node.children[0];
    if (code?.type !== "element" || code.tagName !== "code") return;
    const text = code.children
      .map((child) => (child.type === "text" ? child.value : ""))
      .join("");
    code.data = { ...code.data, rawCode: text };
    const classes = code.properties.className;
    const language = Array.isArray(classes)
      ? String(
          classes.find((name) => String(name).startsWith("language-")) ?? "",
        ).slice(9)
      : "";
    if (language && lowlight.registered(language))
      code.children = lowlight
        .highlight(language, text)
        .children.filter((child) => child.type !== "doctype");
  });
};
