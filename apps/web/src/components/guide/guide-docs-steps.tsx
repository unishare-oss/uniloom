import { GuideSection } from "@/components/guide/guide-section";
import { GuideTable } from "@/components/guide/guide-table";

/** Steps 7 and 8: the Knowledge library, then specs, ADRs and tech debt. */
export const GuideDocsSteps = () => {
  return (
    <>
      <GuideSection id="docs" step={7} title="Knowledge">
        <p>
          Each project has a <b>Knowledge</b> library of Markdown documents for
          what isn&rsquo;t a ticket. Open <b>Knowledge</b> in the sidebar. Use
          the tabs to see one kind, and the search box to find a title. Owners
          and Managers create a document with <b>New document</b>: pick a kind
          and you start from a small template.
        </p>
        <GuideTable
          head={["Kind", "Use it for"]}
          rows={[
            ["Brief", "What you are building and for whom"],
            ["Proposal", "An idea and its options"],
            ["Spec", "How something should behave"],
            ["Reference", "Architecture, tech stack and other notes"],
            [
              "ADR",
              "Guided only. A decision that outlives one ticket (step 8)",
            ],
            [
              "Tech debt",
              "Guided only. A shortcut or problem to fix later (step 8)",
            ],
          ]}
        />
        <p>
          Mermaid diagrams in a doc are drawn on the page. Specs written on a
          ticket are hidden here unless you turn on <b>Show ticket documents</b>
          .
        </p>
      </GuideSection>

      <GuideSection id="guided-docs" step={8} title="Specs, ADRs and tech debt">
        <p>
          In Guided projects, a ticket&rsquo;s <b>Related</b> section, under the
          description, connects it to its documents. You can do these if you may
          edit the ticket: a Member on their own tickets, Owners and Managers on
          any.
        </p>
        <GuideTable
          head={["Button", "What it does"]}
          rows={[
            [
              "New spec",
              'Writes a spec that belongs to this ticket. Slices show their feature\'s spec as "From FEATURE-KEY", read only. A spec is optional.',
            ],
            [
              "Link a document",
              "Links a Knowledge document, such as the tech stack, to this ticket. One document can be linked to many tickets.",
            ],
            [
              "New ADR",
              "Creates an ADR in Knowledge, linked to this ticket. It opens from a template: Context, Options, Decision, Consequences.",
            ],
            [
              "Raise tech debt",
              'Creates a tech debt record in Knowledge, linked to this ticket as "Raised on".',
            ],
          ]}
        />
        <p>
          <b>ADRs</b> are numbered <code>ADR-1</code>, <code>ADR-2</code>… and
          start as Proposed. On the ADR&rsquo;s page, an Owner or Manager
          chooses:
        </p>
        <ul>
          <li>
            <b>Accepted</b> or <b>Rejected</b>.
          </li>
          <li>
            <b>Superseded by…</b> a newer ADR, once an accepted one is replaced.
            ADRs are never deleted, so the history stays readable.
          </li>
        </ul>
        <p>
          <b>Tech debt</b> is numbered <code>TD-1</code>, <code>TD-2</code>… and
          starts as Open. An Owner or Manager closes it:
        </p>
        <ul>
          <li>
            <b>Fixed by…</b> a ticket that is Done in the same project. That
            ticket then lists the debt under Related.
          </li>
          <li>
            <b>Won&rsquo;t fix</b>, when you decide to keep it.
          </li>
        </ul>
        <p className="rounded-lg border px-3 py-2 text-muted-foreground">
          Your agent can also write specs, ADRs and tech debt from a ticket
          (step 9). Accepting, rejecting and closing them happens on the
          website, by people.
        </p>
      </GuideSection>
    </>
  );
};
