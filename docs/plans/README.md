# Potential features

Feature proposals remain **Aligning** until authorized. Plan 29, the UI preview,
is **In Review**. Numbering preserves document identity, not scheduling.

The user confirmed the review-inbox split into three slices. Build order is
**29 (UI preview) → 30 → 31 → 14**. The UI preview was authorized and implemented; backend and live-integration
plans still need Ready status before code.

| Plan                                                                            | Potential feature                                                                                                                                                   | Depends on                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [14: Review inbox and notification history](14-review-inbox.md)                 | Current review work and grouped per-user notification history.                                                                                                      | Plans 30–31; implementation confirmation                                                                          |
| [15: Typed knowledge documents](15-knowledge-documents.md)                      | A project knowledge library with Markdown documents for product briefs, proposals, specifications, and reference notes.                                             | Existing project membership and Markdown/Mermaid rendering.                                                       |
| [16: Structured user-story catalog](16-user-story-catalog.md)                   | Store durable product behavior separately from temporary implementation tickets.                                                                                    | Existing project membership.                                                                                      |
| [17: Open questions and resolution records](17-open-questions.md)               | Project questions with an accountable owner, optional item/document context, and a recorded answer.                                                                 | Existing items and membership; document links are available only after plan 15.                                   |
| [18: Specification revisions and human approval](18-specification-revisions.md) | Preserve specification snapshots and attach human approval to an exact revision.                                                                                    | Plan 15; explicit actor identity for human versus agent callers.                                                  |
| [19: Requirement links and coverage view](19-requirement-coverage.md)           | Connect story acceptance criteria to work items and evidence, then show missing links and claimed progress.                                                         | Plan 16 and existing items/checklists.                                                                            |
| [20: Intended and observed behavior comparison](20-observed-behavior.md)        | Allow people or agents to submit code-backed observations next to approved product intent.                                                                          | Plan 16; plan 18 when observations reference approved specification revisions.                                    |
| [21: Platform and repository coverage matrix](21-platform-parity.md)            | Track how one product behavior is supported across named project targets such as web, mobile clients, or separate repositories.                                     | Plan 16.                                                                                                          |
| [22: Agent context packs](22-agent-context-packs.md)                            | A bounded read that assembles the relevant item, requirements, approved design, decisions, dependencies, and open questions for an agent starting or resuming work. | MCP access and scoped token identity.                                                                             |
| [23: Change impact analysis](23-change-impact.md)                               | When a story criterion or specification revision changes, show explicitly linked work and knowledge that may need review.                                           | Plans 18–19 and explicit document/story relationships.                                                            |
| [24: Documentation drift candidates](24-documentation-drift.md)                 | Compare linked source references against newer repository revisions and flag potentially stale specifications.                                                      | Plan 15, source references pinned to repository/commit, and an authorized repository integration or local import. |
| [25: Preview and import existing knowledge](25-knowledge-import.md)             | Bring Markdown documents and structured story files into a project through a preview-and-confirm flow.                                                              | Plans 15–16.                                                                                                      |
| [26: Curated product onboarding paths](26-onboarding-paths.md)                  | A project owner or manager can arrange existing knowledge into a short reading path explaining concepts, user flows, architecture, and decisions.                   | Plan 15; links to stories and decisions become available as those capabilities ship.                              |
| [27: Project labels](27-labels.md)                                              | Labels and exclusive label groups.                                                                                                                                  | In Review                                                                                                         |
| [28: Board filters](28-board-filters.md)                                        | Filter the board by item metadata.                                                                                                                                  | See plan for alignment                                                                                            |
| [30: Review boundary and submission events](30-review-boundary-and-events.md)   | Reviewer-controlled moves and atomic submission history.                                                                                                            | Existing item/membership rules; Accepted ADR-0011                                                                 |
| [31: Review notification processing](31-review-notification-worker.md)          | In-app fan-out with a Bun/PostgreSQL worker and retry handling.                                                                                                     | Plan 30; Accepted ADR-0011                                                                                        |

| [29: Review inbox UI preview](29-review-inbox-ui.md) | UI-first sample inbox and local read/unread interactions. | In Review; no backend dependency |

## Suggested progression

1. Review inbox: UI preview (29), event capture (30), notification processing (31), then inbox API/UI (14).
2. Knowledge foundation: documents, stories, and questions (15–17).
3. Accountability: revisions, coverage/evidence, and observed behavior (18–20).
4. Context and product reach: platform parity and agent context packs (21–22).
5. Maintenance and adoption: impact, drift, imports, and onboarding (23–26).

This is a suggested dependency sequence, not a change to the existing MVP build order.
Existing planned designs, decisions, documents, and MCP capabilities should be extended
rather than duplicated. Standard-mode knowledge features remain optional; the two-level
work-item hierarchy remains the baseline.

## Review inbox alignment

The user chose both actionable review work and notification history, standalone read
state per recipient, and every project Owner/Manager as initial recipients. Repeated
submissions should retain history while their inbox presentation is grouped. Members
cannot move an item out of In Review; Owners/Managers can return it for more work.

The proposed durable event and worker architecture is recorded in
[ADR-0011](../adr/0011-review-events-and-notifications.md), Accepted for the live implementation. The user first paused plan 30 to review the
UI-first plan 29, then authorized the live backend and integration work. Plans 30,
31, and 14 remain separate slices.

Future improvement: finer recipient selection. Email/push delivery, batching windows,
self-notification preferences, and independent move rate limits are deferred.

[32: Separate CI jobs](32-separate-ci-jobs.md) splits the existing CI workflow into
five independent checks; the user authorized direct changes on dev and main.
