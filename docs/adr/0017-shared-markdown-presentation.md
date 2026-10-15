# ADR-0017: Rich Markdown uses one shared renderer and theme tokens

Status: Proposed
Date: 2026-10-15

## Context

Descriptions, document pages and live previews already use one ReactMarkdown/GFM
renderer with Mermaid support. The user chose richer styling with colored heading
levels, callouts, code controls, navigation and larger diagrams. These choices
should remain consistent wherever Markdown appears.

## Options

1. Add page-specific Markdown renderers and styles.
2. Extend the shared renderer with theme tokens, ordinary Markdown syntax and
   optional document navigation.
3. Replace Markdown with a rich-text document format and editor.

## Decision

Propose option 2. The user chose the rich visual direction; I propose keeping
ordinary Markdown storage and the existing shared renderer. Heading level controls
color as well as typography, but never color alone. Use semantic theme tokens for
light and dark themes. Add GFM-style alert blockquotes, syntax-highlighted fenced
code with copy, heading permalinks, an optional contents list for long document
pages and a standard dialog for expanding Mermaid.

Keep raw HTML disabled and Mermaid in strict mode. Parse headings and contents
from one syntax tree. Limit syntax grammars and preserve lazy Mermaid loading.

## Consequences

- One presentation serves existing and future Markdown without rewriting stored bodies.
- Richer styling requires contrast checks in both themes and keyboard checks for controls.
- Syntax highlighting adds dependency/bundle cost; supported languages stay bounded.
- Contents appears only on long document pages, avoiding extra navigation in compact views.
- This adds no document approval rules, proposal-to-spec dependency or theme editor.
