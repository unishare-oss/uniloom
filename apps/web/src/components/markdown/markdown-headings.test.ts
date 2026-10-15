import assert from "node:assert/strict";
import { test } from "node:test";
import type { Root } from "mdast";
import type { Root as HtmlRoot } from "hast";
import { remarkMarkdownHeadings } from "./markdown-headings";
import { rehypeMarkdownHighlight } from "./markdown-highlight";

test("permalinks handle repeated, Unicode, formatted and empty-slug headings", () => {
  const tree: Root = {
    type: "root",
    children: ["Overview", "Overview", "日本語", "✨", "section"].map(
      (value) => ({
        type: "heading",
        depth: 2,
        children: [{ type: "text", value }],
      }),
    ),
  };
  remarkMarkdownHeadings({ prefix: "doc", contents: true })(tree);
  const ids = tree.children
    .filter((node) => node.type === "heading")
    .map((node) => node.data?.hProperties?.id);
  assert.deepEqual(ids, [
    "doc-overview",
    "doc-overview-1",
    "doc-日本語",
    "doc-section",
    "doc-section-1",
  ]);
  const contents = tree.children[0];
  assert.equal(contents.data?.hName, "nav");
  assert.equal(contents.data?.hProperties?.["aria-label"], "On this page");
});

test("callouts consume only supported markers and preserve normal quotations", () => {
  const tree: Root = {
    type: "root",
    children: ["[!WARNING]\nWatch this.", "[!UNKNOWN]\nOrdinary quotation"].map(
      (value) => ({
        type: "blockquote",
        children: [{ type: "paragraph", children: [{ type: "text", value }] }],
      }),
    ),
  };
  remarkMarkdownHeadings({ prefix: "preview", contents: false })(tree);
  assert.equal(tree.children[0].data?.hName, "aside");
  assert.equal(tree.children[0].data?.hProperties?.["data-callout"], "warning");
  assert.equal(tree.children[1].data?.hName, undefined);
  assert.equal(JSON.stringify(tree).includes("Watch this."), true);
  assert.equal(JSON.stringify(tree).includes("[!UNKNOWN]"), true);
});

test("contents stays absent in compact views and short documents", () => {
  const tree: Root = {
    type: "root",
    children: [
      {
        type: "heading",
        depth: 2,
        children: [{ type: "text", value: "Only section" }],
      },
    ],
  };
  remarkMarkdownHeadings({ prefix: "small", contents: true })(tree);
  assert.equal(tree.children.length, 1);
  assert.equal(tree.children[0].data?.hProperties?.id, "small-only-section");
});

test("highlighting preserves exact copy text and leaves unknown languages plain", () => {
  const source = 'const value = "<script>literal</script>";\n';
  const tree: HtmlRoot = {
    type: "root",
    children: ["typescript", "unknown"].map((language) => ({
      type: "element",
      tagName: "pre",
      properties: {},
      children: [
        {
          type: "element",
          tagName: "code",
          properties: { className: [`language-${language}`] },
          children: [{ type: "text", value: source }],
        },
      ],
    })),
  };
  rehypeMarkdownHighlight()(tree);
  const first = tree.children[0];
  const second = tree.children[1];
  assert.equal(first.type, "element");
  assert.equal(second.type, "element");
  if (first.type !== "element" || second.type !== "element") return;
  const code = first.children[0];
  const plain = second.children[0];
  if (code.type !== "element" || plain.type !== "element") return;
  assert.equal(code.data?.rawCode, source);
  assert.equal(plain.data?.rawCode, source);
  assert.equal(
    code.children.some((node) => node.type === "element"),
    true,
  );
  assert.deepEqual(plain.children, [{ type: "text", value: source }]);
});
