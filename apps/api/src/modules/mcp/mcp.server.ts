import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { INSTRUCTIONS } from './mcp.instructions.js';
import { itemSchema, listItemsSchema, projectSchema } from './mcp.schema.js';
import * as mcpService from './mcp.service.js';
import type { Agent } from './mcp.types.js';
import { reply, toToolError } from './mcp.utils.js';

/**
 * A new server for one request (stateless): the read tools, each calling the service the
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
        'The projects you belong to, with key prefix, mode and rule switches.',
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
        "Slim rows of a project's items. Filter by state name, assignee id or parent item key; get_item has the detail.",
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

  return server;
};
