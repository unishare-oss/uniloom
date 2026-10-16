# ADR-0022: Neobrutalist buttons in the app

Status: Accepted
Date: 2026-10-16

## Context

The landing page uses a neobrutalist look: a 2px `--ink` border and a hard offset `--ink`
shadow. The signed-in app uses plain shadcn buttons (ADR-0005), apart from the comment
buttons from plans 52–53, which were styled by hand. On 2026-10-16 the user asked for all
buttons to follow Unishare, whose `Button` variants carry the look.

## Options

1. **Keep plain shadcn buttons** and undo the comment styling. Consistent, but the app
   doesn't match the landing page or Unishare.
2. **Neobrutalist on every variant**, ghost and link included. One look everywhere, but
   icon buttons, toolbars and the comment actions get heavy and noisy.
3. **Neobrutalist on the filled and outlined variants only** (`default`, `secondary`,
   `outline`, `destructive`), in `ui/button.tsx`; `ghost` and `link` stay flat. This is
   Unishare's split.

## Decision

Option 3. The classes live in `buttonVariants`, so screens don't style buttons
themselves. Uniloom keeps its own sizes and uses `--ink` for the border and shadow in both
themes, as the landing page does. `destructive` becomes solid red, as in Unishare.

## Consequences

- One file sets the look; a screen that passes its own border or shadow classes on a
  `Button` fights it and should drop them.
- A new action button gets the look for free; a quiet one uses `ghost`.
- If the `--ink` shadow reads badly in dark mode, a `--shadow-color` token that is
  transparent in dark mode (Unishare's approach) can replace it without touching screens.
