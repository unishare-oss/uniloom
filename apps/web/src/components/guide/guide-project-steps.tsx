import { GuideSection } from "@/components/guide/guide-section";
import { GuideTable } from "@/components/guide/guide-table";

/** Steps 1 to 3: create a project, use the board, work on a ticket. */
export const GuideProjectSteps = () => {
  return (
    <>
      <GuideSection id="projects" step={1} title="Create a project">
        <p>
          A project has a name and a short key. Every ticket gets a number from
          that key, such as <code>FYP-12</code>. Pick one of two modes when you
          create it.
        </p>
        <GuideTable
          head={["", "Standard", "Guided"]}
          rows={[
            ["Tickets", "Tasks and Subtasks", "Features and Slices"],
            [
              "States",
              "To Do → In Progress → In Review → Done",
              "Triage → Backlog → Aligning → Ready → In Progress → Blocked → In Review → Done → Canceled",
            ],
            [
              "Done-when checklist",
              "Optional",
              "Required, 3 to 6 items per slice",
            ],
            ["Specs, ADRs and tech debt", "–", "✓ (step 8)"],
            [
              "Good for",
              "Teams who want a normal tracker",
              "Teams who plan each slice before coding",
            ],
          ]}
        />
        <p>
          New projects start with a <code>type</code> label group:{" "}
          <code>bug</code>, <code>enhancement</code>, <code>chore</code> and{" "}
          <code>tech-debt</code>.
        </p>
      </GuideSection>

      <GuideSection id="board" step={2} title="Use the board">
        <p>Opening a project shows its board. Each column is a state.</p>
        <ul>
          <li>
            <b>Move a ticket:</b> drag its card to another column. The move only
            happens if the workflow rules allow it (see step 5).
          </li>
          <li>
            <b>Filter:</b> by label, by assignee, or by parent feature. Filters
            combine.
          </li>
          <li>
            <b>Share a view:</b> the filters are saved in the URL, so you can
            bookmark a filtered board or send it to a teammate.
          </li>
          <li>
            <b>Search:</b> type in the search box to find a ticket by title or
            key.
          </li>
        </ul>
      </GuideSection>

      <GuideSection id="ticket" step={3} title="Work on a ticket">
        <p>Click a card to open the ticket page.</p>
        <GuideTable
          head={["Part", "What it does"]}
          rows={[
            ["Title and description", "The description is Markdown."],
            [
              "Assignee",
              "Owners and Managers assign anyone. A Member claims a free ticket, or unclaims their own.",
            ],
            ["Priority", "Urgent, High, Medium, Low or None."],
            [
              "Labels",
              <>
                Only one label per group, so a ticket can&rsquo;t be both{" "}
                <code>bug</code> and <code>chore</code>.
              </>,
            ],
            ["Parent", "The feature or task this one belongs to."],
            ["Blocked by", "Tickets that must be finished first."],
            [
              "Checklist",
              "The done-when items. When you tick one you can add evidence, like a commit SHA or a test name.",
            ],
            [
              "Related",
              "Guided projects only. The ticket's own spec, plus the Knowledge documents, ADRs and tech debt linked to it (step 8).",
            ],
            [
              "Activity",
              "Every change, who made it, and whether it was the person or their agent.",
            ],
          ]}
        />
      </GuideSection>
    </>
  );
};
