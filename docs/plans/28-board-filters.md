# 28: Board filters

Status: In Review

## Scope

The board's filters from `MVP.md` §11 ("filter by assignee, label, feature"), plus the
assignee filter plan 10 left for later. Builds on plan 27's labels.

- **Frontend only** (user decision): the board already loads every item of the project
  and filters the search box in the browser (`board.tsx`). Filtering isn't a permission
  rule, so it doesn't belong in the API. Query parameters on `GET /projects/:id/items`
  come with the MCP `list_items` tool, which needs them for slim responses.
- **Filters combine** (AND across kinds, OR within one): e.g. labels `bug` or `chore`,
  assigned to me.
- **The filter lives in the URL** (`?label=…&assignee=…&parent=…`), so a filtered board
  can be shared, bookmarked and survives a reload. The search box stays as it is.

Left out:

- **API filtering and paging**: with MCP, or when a project grows past what one request
  handles.
- **Saved views**.

## Done when

- [x] A label filter on the board: pick one or more labels; only items with any of them
      show.
- [x] An assignee filter: pick members, "Me" or "Unassigned"; only matching items show.
- [x] An item filter: pick any item (user decision: not only features and tasks); the
      board shows it and its children.
- [x] The filters are read from and written to the URL; a Clear button resets them, and
      the board shows a short note when no item matches.

## Design

| Function                              | File                                     | What                                                                                                                                                                 | Why                                                        |
| ------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `readFilters(searchParams)`           | `web/components/board/board-filters.tsx` | Turns `label`, `assignee`, `parent` params (comma-separated ids, `me`, `none`) into a `{ labelIds, assigneeIds, parentId }` object.                                  | Done-when 4. One place parses the URL.                     |
| `matchesFilters(item, filters, meId)` | `web/components/board/board-filters.tsx` | True when the item passes every set filter.                                                                                                                          | Done-when 1–3. Joins the existing search check in `shown`. |
| `BoardFilters`                        | `web/components/board/board-filters.tsx` | Three dropdowns (labels with chips, members with avatars, parents) and Clear, next to the search box. Writes with `router.replace` so filters don't pile up history. | Done-when 1–4.                                             |
| `Board` (changed)                     | `web/components/board/board.tsx`         | `useSearchParams`, `readFilters`, and `matchesFilters` in the `shown` filter.                                                                                        | Done-when 1–4.                                             |

```mermaid
flowchart LR
    U[URL ?label=&assignee=&parent=] --> R[readFilters]
    R --> M["shown = items.filter(search && matchesFilters)"]
    D[BoardFilters dropdowns] -- router.replace --> U
    M --> C[columns]
```

## Changes

Commits:

- `7a04675` feat(web): board filters by label, assignee and item

- `board-filters.tsx` (new): `readFilters`, `matchesFilters`, `hasFilters` and
  `BoardFilters` (label, assignee and parent dropdowns plus Clear; written with
  `router.replace`). Assignee choices: "Me", "Unassigned" and each member.
- `board.tsx`: reads the URL filters and the current user, joins `matchesFilters` to the
  search check in `shown`, renders `BoardFilters` next to the search box, and shows a
  short note when the search or a filter leaves no item.
- `app/p/[projectId]/page.tsx`: `Board` wrapped in `Suspense` (needed by `useSearchParams`).

Planned vs actual: as planned, plus `hasFilters` (shows Clear only when a filter is set)
and the Suspense wrapper. The item filter lists every item (user decision); picking a feature or task also shows
its children. No API change.
Not clicked through in a browser; lint, typecheck and build pass.
