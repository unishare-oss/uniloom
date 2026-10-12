import { z } from 'zod';
import {
  addChecklistEntrySchema,
  createItemSchema,
  updateChecklistEntrySchema,
} from '@/modules/items/item.schema.js';

const projectKey = z.string().describe('Project key prefix, e.g. TG');
const itemKey = z.string().describe('Item key, e.g. TG-12');
const assignee = z
  .string()
  .describe('"me", "none" or the email of a project member');

export const projectSchema = z.object({ project: projectKey });

export const itemSchema = z.object({ key: itemKey });

export const listItemsSchema = z.object({
  project: projectKey,
  state: z.string().optional().describe('State name, e.g. "In Progress"'),
  assignee: assignee.optional(),
  parent: z.string().optional().describe('Parent item key, e.g. TG-3'),
});

// Text limits are the website's (items/item.schema.ts).
export const saveItemSchema = z.object({
  key: itemKey
    .optional()
    .describe('Leave out to create an item; give it to update that item'),
  project: projectKey
    .optional()
    .describe('Required to create (with kind and title)'),
  kind: createItemSchema.shape.kind.optional().describe('Required to create'),
  title: createItemSchema.shape.title.optional().describe('Required to create'),
  description: createItemSchema.shape.description,
  parent: z.string().optional().describe('Parent item key, e.g. TG-3'),
  priority: createItemSchema.shape.priority,
  assignee: assignee.optional(),
  state: z
    .string()
    .optional()
    .describe(
      'State name to move the item to, e.g. "In Progress". Ready and Done are for people.',
    ),
});

export const setCriteriaSchema = z.object({
  key: itemKey,
  texts: z
    .array(addChecklistEntrySchema.shape.text)
    .max(100)
    .describe('The whole list, in order. Replaces the current one.'),
});

export const checkCriterionSchema = z.object({
  key: itemKey,
  which: z
    .union([z.number().int().min(1), z.string()])
    .describe('The number from get_criteria, or the exact text of the entry'),
  evidence: updateChecklistEntrySchema.shape.evidence.describe(
    'A commit SHA, test name or link that shows it is met',
  ),
});
