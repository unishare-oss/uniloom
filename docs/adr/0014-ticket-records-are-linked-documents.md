# ADR-0014: Specs, ADRs and tech debt are rows in the one document table

Status: Proposed
Date: 2026-10-13

## Context

A ticket has only a description. The user wants each ticket in a Guided project to show
its spec, the ADRs it follows and the tech debt it raised or fixes, and to create them
from the ticket. Some belong to one ticket (a feature's spec); others outlive it (one ADR
guides many tickets; debt found on one ticket is fixed by another). The Knowledge page is
project scope and shouldn't fill up with every feature's spec. ADR-0013 made documents
one table owned by the project and said §8 would add "an optional item or feature link";
MVP §8 attaches documents to "an item, a feature or a project".

## Options

1. **Text inside the ticket**: more fields next to the description. An ADR or a debt
   can't be shared by two tickets and disappears from view with its ticket.
2. **Separate tables** (e.g. `item_spec`, `adr`, `tech_debt`). Each row means one thing and
   the database enforces more, but every table repeats the same shape (title, purpose,
   Markdown body, author, dates): about 15 more functions, a second editor and view, and
   more MCP tools for specs alone. The user weighed this for specs and chose option 3,
   since the shapes are the same.
3. **One document table with a home, links, kinds and statuses.**

## Decision

Option 3. Every spec, ADR, tech debt record and Knowledge document is one `document` row
with a Markdown `body`; nothing is stored as JSON.

- **Home:** `homeItemId` null means a Knowledge document; set means it belongs to that
  ticket (a feature's spec, later §8 change documents), shown on the ticket, deleted with
  it, never in `item_document`.
- **Links:** `item_document` (ids only) links Knowledge documents to tickets, many to many.
  ADRs, tech debt, the tech stack and product-wide specs are Knowledge documents. Creating
  an ADR or tech debt from a ticket creates a Knowledge document and links it.
- **Origin:** `createdFromItemId` records once the ticket a document was created from
  ("Created by NAME from TG-21", "Raised on"); `fixedByItemId` the ticket that fixed a debt.
  Neither depends on a link staying in place.
- **Kinds and statuses:** `DocumentKind` gains `ADR` and `TECH_DEBT`; `number` (per project
  and kind: ADR-7, TD-3), `status` (ADR: Proposed, Accepted, Rejected, Superseded; tech
  debt: Open, Fixed, Won't fix) and `supersededById`.
- **Guided only:** ticket documents, links, ADRs and tech debt exist in Guided projects
  (coding work); Standard projects keep plain Knowledge documents.

This fills in ADR-0013's "optional item link" and adds the link table beside it.

## Consequences

- One editor, Markdown and Mermaid view, list, search and set of MCP tools serve every kind.
- Where a document lives: still useful after its ticket is archived → Knowledge;
  otherwise → the ticket.
- Knowledge queries filter `homeItemId IS NULL`; the column name and its schema comment
  carry that meaning.
- Who edits: a ticket document follows the ticket's edit rule; every Knowledge document
  keeps the current-role rule (Owners and Managers). Which statuses a kind allows, and
  who changes them, are rules in the documents module, not database constraints.
- MVP §7 says Guided only, and §4 and §8 describe tech debt as a record (plan 41).
