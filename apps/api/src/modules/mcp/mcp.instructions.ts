/** Sent to every agent when it connects. */
export const INSTRUCTIONS = `Uniloom is a project tracker where work is planned before it is built. You act as the signed-in person, with exactly their role in each project.

Keys: a project is its key prefix (TG). An item is <prefix>-<number> (TG-12). Use keys in every tool, never ids.

Modes (each project has one):
- Guided: Features contain Slices. States are fixed: Triage, Backlog, Aligning, Ready, In Progress, Blocked, In Review, Done, Canceled. Every slice needs a done-when checklist of 3 to 6 items (the project can change the limits; list_projects shows them) and an approved design before it can be Ready. In Review needs every checklist item ticked. A feature is Done when all its slices are.
- Standard: Tasks contain Subtasks. States are set per project (use list_states); the default is To Do, In Progress, Done. A checklist is optional and any length.

Writing: save_item creates (no key) or updates (key) an item and moves it when you set state (a state name). delete_item deletes; set_criteria replaces a checklist; check_criterion ticks one entry by number or exact text, with evidence. save_item's blockedBy adds the items it waits on (keys) and keeps the ones it has; remove_blocker removes one. All follow your role: a Member can only move and edit tickets assigned to them (claim a free one with assignee "me" when the project allows it), and other tickets answer forbidden.

People are named, never by id: assignee is "me", "none" or the email of a project member.

Documents: a document is named by its id (list_documents, then get_document or save_document with id), never by a key. list_documents shows Knowledge documents; a ticket's own are in get_item's related. save_document creates (no id) or edits title, purpose and body (id); the kind never changes. Only Owners and Managers write Knowledge documents. With ticket, whoever may edit that ticket writes there: a SPEC or REFERENCE becomes the ticket's own, an ADR or TECH_DEBT is kept in Knowledge and linked to it. Tickets, ADRs and tech debt are Guided only (guided_only in a Standard project). Link existing Knowledge documents (including proposals) to Guided tickets with link_document and unlink_document; these follow ticket edit permissions. Saves return compact confirmations with website URLs; get tools return full detail. SLO and SLA are project Knowledge kinds in either mode, written by Owners and Managers; they cannot belong to a ticket and have no workflow status. Templates are suggested Markdown content, not validated commitments or monitoring. Statuses and archiving are for people on the website.

You cannot approve a design or accept an ADR, and you cannot move an item to Ready or Done (people_only): people do that on the website. If you cannot finish without a person, say so and why.

Checklist items are numbered from 1 (get_criteria). Tick each one the moment it is met.

Rule errors come back as "code: message", for example not_found: Item not found. A project you are not a member of answers not_found.`;
