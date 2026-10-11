import { z } from 'zod';

const projectKey = z.string().describe('Project key prefix, e.g. TG');
const itemKey = z.string().describe('Item key, e.g. TG-12');

export const projectSchema = z.object({ project: projectKey });

export const itemSchema = z.object({ key: itemKey });

export const listItemsSchema = z.object({
  project: projectKey,
  state: z.string().optional().describe('State name, e.g. "In Progress"'),
  assignee: z.string().optional().describe('Assignee user id'),
  parent: z.string().optional().describe('Parent item key, e.g. TG-3'),
});
