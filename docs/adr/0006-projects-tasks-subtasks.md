# ADR-0006: Projects hold tasks and subtasks

Status: Accepted
Date: 2026-10-05

## Context

Uniloom is for university teams. A team working on one piece of coursework calls it "our
project", not "our workspace". Standard mode had three item levels, Project → Issue →
Sub-issue (Linear's names): "issue" reads as "something is broken" to people who haven't
used Jira or GitHub, and a Project item inside a project container would be confusing.
The MCP server (§14 step 4) will make these names part of every agent's tools, so this is
the cheapest moment to change them.

## Options

1. Keep Workspace and Project → Issue → Sub-issue.
2. Workspace → Project, and Standard items Milestone → Task → Subtask.
3. Workspace → Project, and Standard items Task → Subtask.

## Decision

Option 3, chosen by the user. The container is a **Project** (like a Jira project, with
its key prefix). Standard items are **Task → Subtask**; Guided stays **Feature → Slice**.
Both modes have two levels. Grouping by deadline comes later from **milestones**: a name
and a due date that a task points to, beside the tree rather than a level in it (post-MVP,
`MVP.md` §16).

The rename is done fully (tables, routes, URLs, enums), not only in what the web shows,
so the API, the MCP tools and the website use one vocabulary.

## Consequences

- One migration renames tables, columns and constraints; old `PROJECT` items become tasks
  and their tasks lose that parent.
- Plans 01 to 06 and ADRs 0001 to 0005 say "workspace" and "issue": they are records of
  their time and are not edited.
- Standard loses its third level; if teams need it, milestones are the planned answer.
