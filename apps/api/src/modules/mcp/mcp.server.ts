import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { INSTRUCTIONS } from './mcp.instructions.js';
import {
  checkCriterionSchema,
  documentLinkSchema,
  getDocumentSchema,
  itemSchema,
  listDocumentsSchema,
  listItemsSchema,
  projectSchema,
  saveDocumentSchema,
  saveItemSchema,
  setCriteriaSchema,
} from './mcp.schema.js';
import * as mcpService from './mcp.service.js';
import type { Agent } from './mcp.types.js';
import { reply, toToolError } from './mcp.utils.js';

/**
 * A new server for one request (stateless): the read and write tools, each calling the service the
 * website uses as the person behind `agent`, so roles and rules are the same.
 */
export const buildServer = (agent: Agent) => {
  const server = new McpServer(
    { name: 'uniloom', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    'list_projects',
    {
      description:
        'The projects you belong to: key, name, mode, your role and the checklist limits (checklistMin, checklistMax; null means no limit).',
    },
    async () => {
      try {
        return reply(await mcpService.listProjects(agent.userId));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_items',
    {
      description:
        "Slim rows of a project's items. Filter by state name, assignee (me, none or a member email) or parent item key; get_item has the detail.",
      inputSchema: listItemsSchema,
    },
    async (input) => {
      try {
        return reply(await mcpService.listItems(agent.userId, input));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'get_item',
    {
      description:
        'One item in full: description, state, labels, blockers and checklist.',
      inputSchema: itemSchema,
    },
    async ({ key }) => {
      try {
        return reply(await mcpService.getItem(agent.userId, key));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_states',
    {
      description: "A project's states in board order, with their category.",
      inputSchema: projectSchema,
    },
    async ({ project }) => {
      try {
        return reply(await mcpService.listStates(agent.userId, project));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_labels',
    {
      description: "A project's labels, with their group.",
      inputSchema: projectSchema,
    },
    async ({ project }) => {
      try {
        return reply(await mcpService.listLabels(agent.userId, project));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'get_criteria',
    {
      description:
        "An item's done-when checklist, numbered from 1, with done and evidence.",
      inputSchema: itemSchema,
    },
    async ({ key }) => {
      try {
        return reply(await mcpService.getCriteria(agent.userId, key));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'save_item',
    {
      description:
        'Returns a compact confirmation; get_item has full detail. Create an item (no key: needs project, kind and title) or update one (key). Set state to move it; Ready and Done are refused with people_only. assignee is me, none or a member email.',
      inputSchema: saveItemSchema,
    },
    async (input) => {
      try {
        return reply(await mcpService.saveItem(agent, input));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'delete_item',
    {
      description:
        'Delete an item (owners and managers only; one with children is refused). It can be restored from the trash on the website.',
      inputSchema: itemSchema,
    },
    async ({ key }) => {
      try {
        return reply(await mcpService.deleteItem(agent, key));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'set_criteria',
    {
      description:
        "Replace an item's whole done-when checklist with these entries, in order; every entry starts unticked. In a Guided project a slice holds 3 to 6 entries by default (list_projects shows the project's limits): if the work needs more, split it into more slices. Over the maximum answers checklist_max_exceeded and keeps the old list.",
      inputSchema: setCriteriaSchema,
    },
    async ({ key, texts }) => {
      try {
        return reply(await mcpService.setCriteria(agent, key, texts));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'check_criterion',
    {
      description:
        'Tick one done-when entry, by its number from get_criteria or its exact text, with optional evidence (a commit SHA, test name or link). Answers the updated checklist.',
      inputSchema: checkCriterionSchema,
    },
    async ({ key, which, evidence }) => {
      try {
        return reply(
          await mcpService.checkCriterion(agent, key, which, evidence),
        );
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_documents',
    {
      description:
        "Slim rows of a project's Knowledge documents (id, kind, title, purpose, number, status), newest edit first. Filter by kind or a search query. A ticket's own documents are in get_item's related.",
      inputSchema: listDocumentsSchema,
    },
    async (input) => {
      try {
        return reply(await mcpService.listDocuments(agent.userId, input));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'get_document',
    {
      description:
        'One document in full by its id: Markdown body, number, status, home ticket and the ticket it was created from.',
      inputSchema: getDocumentSchema,
    },
    async ({ id }) => {
      try {
        return reply(await mcpService.getDocument(agent.userId, id));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'save_document',
    {
      description:
        'Returns a compact confirmation; get_document has the body. Create a document (no id: needs project, kind and title; give ticket to write it from that ticket) or edit title, purpose, body and optional SPEC sourceProposalId of one (id). SPEC may name one active same-project Knowledge PROPOSAL; omit to preserve, null clears. This is provenance, not approval. Body is Markdown; sections by kind: BRIEF: Problem, Goal, Users, Out of scope. PROPOSAL: Summary, Motivation, Options, Recommendation, Open questions. SPEC: Overview, Behaviour, Edge cases, Acceptance. REFERENCE: Overview, Details, Links. TECH_DEBT: What, Why it matters, Suggested fix. ADR: Context, Options, Decision, Consequences. SLO: Service/journey, Indicator (SLI), Target and window, Measurement source, Owner, Exclusions, Response policy, Related documents. SLA: Audience/customer, Service commitments, Measurement terms, Exclusions, Remedies, Effective dates, Accountable owner, Agreement state, Supporting SLOs. SLO and SLA are project Knowledge documents with no workflow status; saving an SLA records no acceptance. With ticket the kind is SPEC, REFERENCE, ADR or TECH_DEBT.',
      inputSchema: saveDocumentSchema,
    },
    async (input) => {
      try {
        return reply(await mcpService.saveDocument(agent, input));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'link_document',
    {
      description:
        'Link an existing Knowledge document to a Guided ticket. Takes ticket key and document id; follows ticket edit permissions. Repeating a link is harmless.',
      inputSchema: documentLinkSchema,
    },
    async ({ key, id }) => {
      try {
        return reply(await mcpService.linkDocument(agent, key, id));
      } catch (error) {
        return toToolError(error);
      }
    },
  );
  server.registerTool(
    'unlink_document',
    {
      description:
        'Remove a Knowledge document link from a Guided ticket, preserving the document. Follows ticket edit permissions.',
      inputSchema: documentLinkSchema,
    },
    async ({ key, id }) => {
      try {
        return reply(await mcpService.unlinkDocument(agent, key, id));
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  return server;
};
