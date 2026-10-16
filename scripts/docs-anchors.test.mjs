// Every SETUP.md#anchor link in README, and every internal #anchor link in
// SETUP.md itself, must resolve to a real heading (GitHub slug rules).
// Run: bun test scripts/
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

const slug = (heading) =>
  heading
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s\-_]/gu, "")
    .replace(/[\s_]+/g, "-");

const headingsOf = (file) =>
  new Set(
    [
      ...readFileSync(resolve(root, file), "utf8").matchAll(
        /^#{1,6}\s+(.+)$/gm,
      ),
    ].map((m) => slug(m[1].replace(/\[(.*?)\]\(.*?\)/g, "$1"))),
  );

const anchorsIn = (file) =>
  [
    ...readFileSync(resolve(root, file), "utf8").matchAll(
      /\[([^\]]*)\]\(([^)\s]+)\)/g,
    ),
  ]
    .map((m) => ({ text: m[1], target: m[2] }))
    .filter((l) => l.target.includes("#"))
    .filter(
      (l) =>
        l.target.startsWith("#") ||
        /(^|\/)SETUP\.md#/.test(l.target) ||
        /(^|\/)README\.md#/.test(l.target),
    )
    .map((l) => {
      const [filePart, frag] = l.target.split("#");
      const page =
        filePart === "" || filePart === file
          ? file
          : filePart.endsWith("SETUP.md")
            ? "SETUP.md"
            : "README.md";
      return { ...l, page, frag: frag.toLowerCase() };
    });

for (const file of ["README.md", "SETUP.md"]) {
  test(`${file}: every doc anchor resolves`, () => {
    const headings = headingsOf("README.md");
    const setupHeadings = headingsOf("SETUP.md");
    const broken = anchorsIn(file).filter((l) =>
      l.page === "SETUP.md"
        ? !setupHeadings.has(l.frag)
        : !headings.has(l.frag),
    );
    expect(
      broken.map((l) => `[${l.text}](${l.target})`),
      "broken anchors",
    ).toEqual([]);
  });
}
