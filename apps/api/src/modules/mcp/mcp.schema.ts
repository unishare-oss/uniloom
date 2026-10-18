import { z } from 'zod';
import {
  createDocumentSchema,
  listDocumentsQuerySchema,
} from '@/modules/documents/document.schema.js';
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
  blockedBy: z
    .array(z.string())
    .optional()
    .describe(
      'Item keys this item waits on, e.g. ["TG-3"]. Adds them and never removes; keys already linked are skipped. Leave out to change nothing.',
    ),
});

export const removeBlockerSchema = z.object({
  key: itemKey,
  blocker: itemKey.describe('The item key it no longer waits on, e.g. TG-3'),
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

const documentId = z
  .string()
  .describe("Document id, from list_documents or get_item's related");

export const listDocumentsSchema = z.object({
  project: projectKey,
  kind: listDocumentsQuerySchema.shape.kind.describe('Only this kind'),
  query: listDocumentsQuerySchema.shape.q.describe(
    'Search the title and purpose',
  ),
  archived: z.boolean().optional().describe('true also lists archived ones'),
});

export const getDocumentSchema = z.object({ id: documentId });

export const documentLinkSchema = z.object({ key: itemKey, id: documentId });

// Text limits are the website's (documents/document.schema.ts).
export const saveDocumentSchema = z.object({
  id: documentId
    .optional()
    .describe('Leave out to create a document; give it to update that one'),
  project: projectKey
    .optional()
    .describe('Required to create (with kind and title)'),
  kind: createDocumentSchema.shape.kind
    .optional()
    .describe('Required to create. Never changes afterwards'),
  title: createDocumentSchema.shape.title
    .optional()
    .describe('Required to create'),
  purpose: createDocumentSchema.shape.purpose.describe(
    'One line: what it is for',
  ),
  body: createDocumentSchema.shape.body.describe('Markdown'),
  sourceProposalId: createDocumentSchema.shape.sourceProposalId.describe(
    'SPEC only: optional same-project active Knowledge proposal id. Omit to preserve on edit; null clears. Provenance does not imply approval.',
  ),
  ticket: itemKey
    .optional()
    .describe(
      'Create from this ticket (Guided projects): SPEC and REFERENCE belong to it; ADR and TECH_DEBT are kept in Knowledge and linked to it',
    ),
  status: z
    .string()
    .optional()
    .describe('Not accepted: statuses are for people on the website'),
});
