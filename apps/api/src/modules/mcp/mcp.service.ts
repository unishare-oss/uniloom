import { apiError } from '@/http.js';
import * as itemService from '@/modules/items/item.service.js';
import * as labelService from '@/modules/labels/label.service.js';
import * as projectService from '@/modules/projects/project.service.js';
import * as mcpRepo from './mcp.repository.js';
import { toCriteria } from './mcp.utils.js';

/** A project's id from its key prefix, or the same 404 a non-member gets. */
const findProjectId = async (key: string) => {
  const id = await mcpRepo.findProjectIdByKey(key.trim().toUpperCase());
  if (!id) throw apiError(404, 'not_found', 'Project not found');
  return id;
};

/** An item's id from its key (TG-12), or 404. */
const findItemId = async (key: string) => {
  const match = key.trim().match(/^([A-Za-z]+)-(\d+)$/);
  const id = match
    ? await mcpRepo.findItemIdByKey(match[1].toUpperCase(), Number(match[2]))
    : undefined;
  if (!id) throw apiError(404, 'not_found', 'Item not found');
  return id;
};

export const listProjects = (userId: string) => {
  return projectService.listProjects(userId);
};

/** A project's slim item rows, filtered by state name, assignee id and parent key. */
export const listItems = async (
  userId: string,
  input: {
    project: string;
    state?: string;
    assignee?: string;
    parent?: string;
  },
) => {
  const projectId = await findProjectId(input.project);
  let items = await itemService.listProjectItems(projectId, userId);
  if (input.parent) {
    // Looked up among this project's items only, so a key from a private
    // project answers the same not_found as a key that doesn't exist.
    const parentKey = input.parent.trim().toUpperCase();
    const parent = items.find((item) => item.key === parentKey);
    if (!parent) throw apiError(404, 'not_found', 'Item not found');
    items = items.filter((item) => item.parentId === parent.id);
  }
  if (input.state) {
    const state = input.state.toLowerCase();
    items = items.filter((item) => item.state.name.toLowerCase() === state);
  }
  if (input.assignee)
    items = items.filter((item) => item.assigneeId === input.assignee);
  return items;
};

export const getItem = async (userId: string, key: string) => {
  return itemService.getItem(await findItemId(key), userId);
};

/** A project's states in board order. */
export const listStates = async (userId: string, project: string) => {
  const detail = await projectService.getProject(
    await findProjectId(project),
    userId,
  );
  return detail.states;
};

export const listLabels = async (userId: string, project: string) => {
  return labelService.listLabels(await findProjectId(project), userId);
};

/** An item's done-when checklist, numbered from 1. */
export const getCriteria = async (userId: string, key: string) => {
  const item = await itemService.getItem(await findItemId(key), userId);
  return toCriteria(item.checklist);
};
