# ADR-0005: The web app's look and UI kit

Status: Proposed
Date: 2026-10-04

## Context

Plan 06 builds the first real pages (workspaces, board, item, trash). Every later page
(designs, ADRs, the review page) will reuse their look and parts, so the choices should be
written down once. The user compared several looks on a design canvas
(https://claude.ai/artifact/8ESvEVsPi9pQChCusHf2vq): UniShare's theme, a calm slate palette,
a Jira clone, and Jira's layout with Uniloom's own details.

## Options

- **UniTheme (UniShare's palettes):** shared with other UniCorp apps, but a private package
  (a token in CI and Docker), and its amber buttons fail text contrast.
- **A Jira clone:** familiar, but Atlassian's exact colours, icons and words read as a copy.
- **Jira's density and layout, Uniloom's own details:** one blue accent, own type and
  priority icons, Geist; the sidebar and workspace cards in UniShare's outlined style.

## Decision

The third option:

- **Colours** only as shadcn CSS variables in `apps/web/src/app/globals.css`: light under
  `:root`, dark (neutral greys, not blue-tinted) under `.dark`. One accent, blue
  (`--primary`); extra tokens for ink (outlines and offset shadows), board columns, item
  kinds, urgent and done. Components never hard-code a colour.
- **Texture and accent:** a dot grid behind the board (`bg-dots`), and column tops in their
  state's colour (`stateTopClass`, `--state-*` tokens). Colour carries meaning (Blocked red, Done
  green) rather than decoration.
- **Theme:** `next-themes`, following the system unless the user picks Light or Dark on
  `/profile`.
- **Components:** shadcn (Base UI) in `src/components/ui/`, including its Sidebar; added
  with `bunx shadcn add`, not written by hand.
- **Icons:** `lucide-react` only. Item kinds are lucide glyphs on the kind's colour
  (`KindIcon`); priorities are lucide's signal bars (`PriorityIcon`).
- **Fonts:** Geist and Geist Mono through `next/font`.
- **Markdown:** `react-markdown` + `remark-gfm`, Mermaid loaded only for diagrams
  (`src/components/markdown/markdown.tsx`).
- **Drag and drop:** `@dnd-kit/core`.

## Consequences

- Dark mode and any later palette change touch one file.
- No private package to install in CI or Docker; UniTheme can still be added later as a
  theme picker.
- New pages reuse `KindIcon`, `PriorityIcon`, `StateLozenge` and `Markdown` instead of
  drawing their own.
