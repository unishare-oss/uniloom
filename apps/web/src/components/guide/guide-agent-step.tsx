import Link from "next/link";
import { GuideAgentSetups } from "@/components/guide/guide-agent-setups";
import { GuideSection } from "@/components/guide/guide-section";
import { GuideTable } from "@/components/guide/guide-table";

/** Step 9: connect an agent. The setup commands come from the Connect agent page's list. */
export const GuideAgentStep = () => {
  return (
    <GuideSection id="agent" step={9} title="Connect your agent">
      <p>
        Open{" "}
        <b>
          <Link href="/profile/agent" className="underline">
            Profile → Connect an agent
          </Link>
        </b>
        . It shows your server address and the setup for each agent. The address
        is your Uniloom site plus <code>/mcp</code>:
      </p>
      <GuideAgentSetups />
      <p>
        Then talk to your agent, for example: &ldquo;Create a task for thesis
        upload with three subtasks&rdquo; or &ldquo;Tick the PDF check on FYP-12
        with the commit SHA&rdquo;.
      </p>
      <p>
        Your agent acts as you, with your role. Its changes appear on the board
        and in each ticket&rsquo;s activity as your agent&rsquo;s.
      </p>
      <p>Tools your agent gets:</p>
      <GuideTable
        head={["Area", "Tools"]}
        rows={[
          [
            "Projects",
            <>
              <code>list_projects</code>, <code>list_labels</code>,{" "}
              <code>list_states</code>
            </>,
          ],
          [
            "Tickets",
            <>
              <code>list_items</code>, <code>get_item</code>,{" "}
              <code>save_item</code>, <code>delete_item</code>,{" "}
              <code>remove_blocker</code>
            </>,
          ],
          [
            "Checklist",
            <>
              <code>set_criteria</code>, <code>check_criterion</code>,{" "}
              <code>get_criteria</code>
            </>,
          ],
          [
            "Documents",
            <>
              <code>list_documents</code>, <code>get_document</code>,{" "}
              <code>save_document</code>
            </>,
          ],
        ]}
      />
      <p>
        <b>Documents over MCP</b> follow the same rules as the website:
      </p>
      <ul>
        <li>Every member&rsquo;s agent can read Knowledge documents.</li>
        <li>
          Only an Owner&rsquo;s or Manager&rsquo;s agent creates or edits a
          Knowledge document.
        </li>
        <li>
          Any agent can write a spec, ADR or tech debt from a ticket its person
          may edit, for example &ldquo;Write a spec on FYP-12&rdquo; or
          &ldquo;Raise tech debt from FYP-12&rdquo;. This works in Guided
          projects only.
        </li>
        <li>
          Agents can&rsquo;t accept or reject ADRs, close tech debt, or archive
          documents. People do that on the website.
        </li>
      </ul>
    </GuideSection>
  );
};
