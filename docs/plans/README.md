# Potential features

These are optional feature proposals. Every plan is **Aligning**; none authorizes
implementation. Their numbering preserves document identity, not scheduling.

The user authorized documenting these possibilities and nominated the review inbox
as the next candidate. **Ask the user before starting it.** The user must confirm
its scope and set plan 14 to Ready. No application code is part of this documentation work.

| Plan | Potential feature | Depends on |
| --- | --- | --- |
| [14: Review inbox](14-review-inbox.md) | A cross-project page where owners and managers find implementation work waiting for their review. | Existing project/item capabilities; separate user confirmation |
| [15: Typed knowledge documents](15-knowledge-documents.md) | A project knowledge library with Markdown documents for product briefs, proposals, specifications, and reference notes. | Existing project membership and Markdown/Mermaid rendering. |
| [16: Structured user-story catalog](16-user-story-catalog.md) | Store durable product behavior separately from temporary implementation tickets. | Existing project membership. |
| [17: Open questions and resolution records](17-open-questions.md) | Project questions with an accountable owner, optional item/document context, and a recorded answer. | Existing items and membership; document links are available only after plan 15. |
| [18: Specification revisions and human approval](18-specification-revisions.md) | Preserve specification snapshots and attach human approval to an exact revision. | Plan 15; explicit actor identity for human versus agent callers. |
| [19: Requirement links and coverage view](19-requirement-coverage.md) | Connect story acceptance criteria to work items and evidence, then show missing links and claimed progress. | Plan 16 and existing items/checklists. |
| [20: Intended and observed behavior comparison](20-observed-behavior.md) | Allow people or agents to submit code-backed observations next to approved product intent. | Plan 16; plan 18 when observations reference approved specification revisions. |
| [21: Platform and repository coverage matrix](21-platform-parity.md) | Track how one product behavior is supported across named project targets such as web, mobile clients, or separate repositories. | Plan 16. |
| [22: Agent context packs](22-agent-context-packs.md) | A bounded read that assembles the relevant item, requirements, approved design, decisions, dependencies, and open questions for an agent starting or resuming work. | MCP access and scoped token identity. |
| [23: Change impact analysis](23-change-impact.md) | When a story criterion or specification revision changes, show explicitly linked work and knowledge that may need review. | Plans 18–19 and explicit document/story relationships. |
| [24: Documentation drift candidates](24-documentation-drift.md) | Compare linked source references against newer repository revisions and flag potentially stale specifications. | Plan 15, source references pinned to repository/commit, and an authorized repository integration or local import. |
| [25: Preview and import existing knowledge](25-knowledge-import.md) | Bring Markdown documents and structured story files into a project through a preview-and-confirm flow. | Plans 15–16. |
| [26: Curated product onboarding paths](26-onboarding-paths.md) | A project owner or manager can arrange existing knowledge into a short reading path explaining concepts, user flows, architecture, and decisions. | Plan 15; links to stories and decisions become available as those capabilities ship. |

## Suggested progression

1. Review inbox: confirm the initial read-only implementation-review queue first.
2. Knowledge foundation: documents, stories, and questions (15–17).
3. Accountability: revisions, coverage/evidence, and observed behavior (18–20).
4. Context and product reach: platform parity and agent context packs (21–22).
5. Maintenance and adoption: impact, drift, imports, and onboarding (23–26).

This is a suggested dependency sequence, not a change to the existing MVP build order.
Existing planned designs, decisions, documents, and MCP capabilities should be extended
rather than duplicated. Standard-mode knowledge features remain optional; the two-level
work-item hierarchy remains the baseline.

## Review inbox scope to confirm

Plan 14 proposes a global /reviews page listing live Guided items in In Review across
projects where the person is Owner or Manager. It provides project filtering,
pagination, and links to item pages. It introduces no new review state or review action.

Design approvals, ADR acceptance, question queues, notifications, reviewer assignment,
and bulk decisions can be proposed as later inbox slices when their source capabilities
exist. The initial inbox does not require the rest of these proposals to be built.
