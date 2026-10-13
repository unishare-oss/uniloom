import { GuideSection } from "@/components/guide/guide-section";
import { GuideTable } from "@/components/guide/guide-table";

/** Steps 4 to 6: members and roles, workflow rules, review inbox. */
export const GuideTeamSteps = () => {
  return (
    <>
      <GuideSection id="roles" step={4} title="Members and roles">
        <p>
          Open <b>Members</b> in a project to add people by email. A project
          always keeps at least one Owner, and anyone can leave a project.
        </p>
        <GuideTable
          head={["Can they…", "Owner", "Manager", "Member"]}
          rows={[
            ["Read and comment on every ticket", "✓", "✓", "✓"],
            ["Create, delete and restore tickets", "✓", "✓", "–"],
            ["Assign anyone to a ticket", "✓", "✓", "claim only"],
            ["Edit and move a ticket", "any", "any", "only their own"],
            ["Move to Done, or out of In Review", "✓", "✓", "–"],
            ["Write and edit Knowledge documents", "✓", "✓", "–"],
            [
              "Write a spec, link a doc, raise tech debt on a ticket",
              "any ticket",
              "any ticket",
              "only their own",
            ],
            ["Accept or reject ADRs, close tech debt", "✓", "✓", "–"],
            ["Add members", "any role", "as Member", "–"],
            ["Change roles and project settings", "✓", "–", "–"],
          ]}
        />
      </GuideSection>

      <GuideSection id="rules" step={5} title="Workflow rules">
        <p>
          The rules live on the server, so the website and your agent follow the
          same ones. When a move is refused, Uniloom tells you why.
        </p>
        <GuideTable
          head={["Rule", "What happens"]}
          rows={[
            [
              "Tick everything before review",
              <>
                In Review and Done need every checklist item ticked. Otherwise:{" "}
                <code>criteria_incomplete</code>.
              </>,
            ],
            [
              "Keep slices small",
              <>
                A checklist can&rsquo;t grow past the project&rsquo;s limit.
                Split the ticket instead. Otherwise:{" "}
                <code>checklist_max_exceeded</code>.
              </>,
            ],
            [
              "Members move their own tickets",
              "A free ticket has to be claimed first.",
            ],
            [
              "People close the work",
              "Only Owners and Managers move a ticket to Done or send it back from In Review.",
            ],
            [
              "Features finish themselves",
              "A feature goes to Done when all its slices are Done or Canceled.",
            ],
            [
              "Agents never approve",
              "An agent can't move a ticket to Ready or Done, even an Owner's agent.",
            ],
          ]}
        />
      </GuideSection>

      <GuideSection id="reviews" step={6} title="Review inbox">
        <p>
          When a ticket moves to In Review, every Owner and Manager of that
          project gets a notification.
        </p>
        <ol>
          <li>
            Open <b>Reviews</b> from the sidebar.
          </li>
          <li>Click a notification to open the ticket and review it.</li>
          <li>
            Move it to Done, or send it back to In Progress with a comment.
          </li>
        </ol>
        <p className="rounded-lg border px-3 py-2 text-muted-foreground">
          If the same ticket is sent for review more than once, its
          notifications are grouped. Read and unread is tracked for each person
          separately.
        </p>
      </GuideSection>
    </>
  );
};
