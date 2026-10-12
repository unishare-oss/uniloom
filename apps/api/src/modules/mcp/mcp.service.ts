import { HTTPException } from 'hono/http-exception';
import { apiError } from '@/http.js';
import * as checklistService from '@/modules/items/checklist.service.js';
import * as itemService from '@/modules/items/item.service.js';
import type { ItemKind, Priority } from '@/generated/prisma/enums.js';
import * as labelService from '@/modules/labels/label.service.js';
import * as memberService from '@/modules/members/member.service.js';
import * as projectService from '@/modules/projects/project.service.js';
import * as mcpRepo from './mcp.repository.js';
import { isPeopleOnlyTarget } from './mcp.rules.js';
import type { Agent } from './mcp.types.js';
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

/**
 * The assignee as an agent writes it: `me`, `none` or a member's email. Returns the user
 * id, or null for `none`. An email that is no member's answers 400 `invalid_assignee`.
 */
const findAssigneeId = async (
  projectId: string,
  value: string,
  userId: string,
) => {
  const text = value.trim().toLowerCase();
  if (text === 'me') return userId;
  if (text === 'none') return null;
  const members = await memberService.listMembers(projectId, userId);
  const member = members.find((m) => m.email.toLowerCase() === text);
  if (!member)
    throw apiError(
      400,
      'invalid_assignee',
      'The assignee must be "me", "none" or the email of a project member',
    );
  return member.userId;
};

/** A state of the project by name, case-insensitive, or 400 `invalid_state`. */
const findState = async (projectId: string, name: string, userId: string) => {
  const detail = await projectService.getProject(projectId, userId);
  const wanted = name.trim().toLowerCase();
  const state = detail.states.find((s) => s.name.toLowerCase() === wanted);
  if (!state)
    throw apiError(
      400,
      'invalid_state',
      `No state named "${name}": ${detail.states.map((s) => s.name).join(', ')}`,
    );
  return state;
};

/** The projects the person belongs to, with their role and the checklist limits. */
export const listProjects = async (userId: string) => {
  const projects = await projectService.listProjects(userId);
  return Promise.all(
    projects.map(async (project) => {
      const detail = await projectService.getProject(project.id, userId);
      return {
        key: project.keyPrefix,
        name: project.name,
        mode: project.mode,
        role: detail.role,
        checklistMin: project.checklistMin,
        checklistMax: project.checklistMax,
      };
    }),
  );
};

/** A project's slim item rows, filtered by state name, assignee and parent key. */
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
  if (input.assignee) {
    const assigneeId = await findAssigneeId(projectId, input.assignee, userId);
    items = items.filter((item) => item.assigneeId === assigneeId);
  }
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

/**
 * Creates an item (no `key`) or updates one (`key`), then moves it when `state` is set.
 * The state is checked first, so a refused move leaves no half-saved item.
 */
export const saveItem = async (
  agent: Agent,
  input: {
    key?: string;
    project?: string;
    kind?: ItemKind;
    title?: string;
    description?: string;
    parent?: string;
    priority?: Priority;
    assignee?: string;
    state?: string;
  },
) => {
  const { userId } = agent;
  const itemId = input.key ? await findItemId(input.key) : null;
  if (!itemId && (!input.project || !input.kind || !input.title))
    throw apiError(
      400,
      'invalid_input',
      'Creating an item needs project, kind and title',
    );
  const projectId = itemId
    ? (await itemService.getItem(itemId, userId)).projectId
    : await findProjectId(input.project!);

  const state = input.state
    ? await findState(projectId, input.state, userId)
    : null;
  if (state && isPeopleOnlyTarget(state))
    throw apiError(
      403,
      'people_only',
      `Agents cannot move an item to ${state.name}: ask a person to do it on the website`,
    );
  const parentId = input.parent ? await findItemId(input.parent) : undefined;
  const assigneeId =
    input.assignee === undefined
      ? undefined
      : await findAssigneeId(projectId, input.assignee, userId);

  const fields = {
    title: input.title,
    description: input.description,
    parentId,
    priority: input.priority,
    assigneeId,
  };
  let id = itemId;
  let saved = '';
  if (!id) {
    const created = await itemService.createProjectItem(
      projectId,
      userId,
      { ...fields, kind: input.kind!, title: input.title! },
      agent,
    );
    id = created.id;
    saved = `${created.key} was created`;
  } else if (Object.values(fields).some((value) => value !== undefined)) {
    await itemService.updateProjectItem(id, userId, fields, agent);
    saved = `${input.key!.trim().toUpperCase()}'s changes are saved`;
  }
  if (state) {
    // The move is its own transaction: when it fails after a create or an edit, say what
    // was already saved, so the agent doesn't create the item again.
    try {
      await itemService.moveItem(id, userId, state.id, agent);
    } catch (error) {
      if (!saved || !(error instanceof HTTPException) || !error.res)
        throw error;
      const body = (await error.res.clone().json()) as {
        code: string;
        message: string;
      };
      throw apiError(
        error.status,
        body.code,
        `${saved}, but it was not moved to ${state.name}: ${body.message}`,
      );
    }
  }
  return itemService.getItem(id, userId);
};

export const deleteItem = async (agent: Agent, key: string) => {
  await itemService.removeItem(await findItemId(key), agent.userId, agent);
  return { deleted: key.trim().toUpperCase() };
};

/** Replaces an item's checklist; answers the new list, numbered from 1. */
export const setCriteria = async (
  agent: Agent,
  key: string,
  texts: string[],
) => {
  const entries = await checklistService.replaceChecklist(
    await findItemId(key),
    agent.userId,
    texts,
    agent,
  );
  return toCriteria(entries);
};

/** Ticks one entry, picked by its number from get_criteria or by its exact text. */
export const checkCriterion = async (
  agent: Agent,
  key: string,
  which: number | string,
  evidence?: string | null,
) => {
  const itemId = await findItemId(key);
  const { checklist } = await itemService.getItem(itemId, agent.userId);
  // A string is the exact text; failing that, digits only ("2") count as the number.
  const number =
    typeof which === 'number' ? which : /^\d+$/.test(which) ? Number(which) : 0;
  const entry =
    typeof which === 'string' && checklist.some((e) => e.text === which)
      ? checklist.find((e) => e.text === which)
      : checklist[number - 1];
  if (!entry) throw apiError(404, 'not_found', 'Checklist entry not found');
  await checklistService.updateChecklistEntry(
    itemId,
    entry.id,
    agent.userId,
    { done: true, evidence },
    agent,
  );
  return toCriteria(
    (await itemService.getItem(itemId, agent.userId)).checklist,
  );
};
