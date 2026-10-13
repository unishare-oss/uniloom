import { z } from 'zod';
import { DocumentStatus, LabelColor } from '@/generated/prisma/enums.js';

const priority = z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']);

export const createItemSchema = z.object({
  kind: z.enum(['TASK', 'SUBTASK', 'FEATURE', 'SLICE']),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(50_000).optional(),
  parentId: z.uuid().nullish(),
  priority: priority.optional(),
  assigneeId: z.string().min(1).nullish(),
  stateId: z.uuid().optional(),
});

export const updateItemSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(50_000).optional(),
  parentId: z.uuid().nullable().optional(),
  priority: priority.optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  /** Replaces the item's labels; two of one group are refused. */
  labelIds: z.array(z.uuid()).max(50).optional(),
});

export const moveItemSchema = z.object({ stateId: z.uuid() });

export const addBlockerSchema = z.object({ blockerId: z.uuid() });

export const linkDocumentSchema = z.object({ documentId: z.uuid() });

/** A document written from a ticket: its own spec or reference, or an ADR kept in Knowledge. */
export const createTicketDocumentSchema = z.object({
  kind: z.enum(['SPEC', 'REFERENCE', 'ADR', 'TECH_DEBT']),
  title: z.string().trim().min(1).max(200),
  purpose: z.string().trim().max(300).optional(),
  body: z.string().max(100_000).optional(),
});

const kind = z.enum(['TASK', 'SUBTASK', 'FEATURE', 'SLICE']);

export const checklistEntrySchema = z.object({
  id: z.uuid(),
  text: z.string(),
  done: z.boolean(),
  /** Free text: a commit SHA, test name or link. */
  evidence: z.string().nullable(),
  /** 0-based place in the list. */
  position: z.number().int(),
});

export const addChecklistEntrySchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export const updateChecklistEntrySchema = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  done: z.boolean().optional(),
  /** Empty or null clears it. */
  evidence: z.string().trim().max(500).nullable().optional(),
});

export const reorderChecklistSchema = z.object({ ids: z.array(z.uuid()) });

export const itemLabelSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.enum(LabelColor),
});

export const itemSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  projectId: z.uuid(),
  kind,
  title: z.string(),
  description: z.string(),
  state: z.object({
    id: z.uuid(),
    name: z.string(),
    key: z.string().nullable(),
    category: z.enum(['BACKLOG', 'UNSTARTED', 'STARTED', 'DONE', 'CANCELED']),
  }),
  priority,
  assigneeId: z.string().nullable(),
  /** Whether the caller may move it: the web reads this and never repeats the rule. */
  canMove: z.boolean(),
  /** Whether the caller may edit its fields, checklist and blockers: the web never repeats the rule. */
  canEdit: z.boolean(),
  parentId: z.uuid().nullable(),
  createdById: z.string().nullable(),
  /** Ids of the items this one waits on. */
  blockedBy: z.array(z.uuid()),
  /** The done-when entries, in order. */
  checklist: z.array(checklistEntrySchema),
  /** The item's labels, by name. */
  labels: z.array(itemLabelSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** A document on the item page, without its body. */
export const relatedDocumentSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['BRIEF', 'PROPOSAL', 'SPEC', 'REFERENCE', 'ADR', 'TECH_DEBT']),
  /** ADR-7: per project and kind; null for kinds without a number. */
  number: z.number().int().nullable(),
  status: z.enum(DocumentStatus).nullable(),
  title: z.string(),
  archived: z.boolean(),
  /** `ticket`: belongs to a ticket (the item or its parent); `project`: a Knowledge document. */
  home: z.enum(['ticket', 'project']),
  /** The parent's key when the document comes from the parent (read only); null when it is the item's own. */
  from: z.string().nullable(),
});

/** One item with the documents it shows under its description. */
export const itemDetailSchema = itemSchema.extend({
  /** The kinds a person may start from this ticket; empty in a Standard project. */
  ticketDocumentKinds: z.array(z.enum(['SPEC', 'ADR', 'TECH_DEBT'])),
  /** Empty in a Standard project. */
  related: z.array(relatedDocumentSchema),
});

export const itemRowSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  kind,
  title: z.string(),
  state: z.object({ id: z.uuid(), name: z.string() }),
  priority,
  assigneeId: z.string().nullable(),
  canMove: z.boolean(),
  parentId: z.uuid().nullable(),
  labels: z.array(itemLabelSchema),
});

export const deletedItemRowSchema = itemRowSchema.extend({
  deletedAt: z.iso.datetime(),
});

/** Who changed it and when: shared by every activity row. */
const activityRow = {
  id: z.uuid(),
  /** Null when the person's account is gone. */
  by: z.object({ name: z.string().nullable(), image: z.string().nullable() }),
  /** Set when the person's agent made the change; `name` is the client's own claim. */
  agent: z.object({ name: z.string().nullable() }).nullable(),
  at: z.iso.datetime(),
};

const activityChange = z.object({
  field: z.enum(['title', 'description', 'priority', 'assignee', 'parent']),
  /** Left out for long text (description). Names for people and states, codes for enums. */
  from: z.string().nullish(),
  to: z.string().nullish(),
});

/** One row of an item's history. `detail` depends on `action`. */
export const activitySchema = z.discriminatedUnion('action', [
  z.object({
    ...activityRow,
    action: z.literal('item.create'),
    /** The parent's key, or null. */
    detail: z.object({ parent: z.string().nullable() }),
  }),
  z.object({
    ...activityRow,
    action: z.literal('item.update'),
    detail: z.object({ changes: z.array(activityChange) }),
  }),
  z.object({
    ...activityRow,
    action: z.literal('item.move'),
    detail: z.object({ from: z.string(), to: z.string() }),
  }),
  z.object({
    ...activityRow,
    action: z.literal('item.delete'),
    detail: z.object({}),
  }),
  z.object({
    ...activityRow,
    action: z.literal('item.restore'),
    detail: z.object({}),
  }),
  z.object({
    ...activityRow,
    action: z.literal('checklist.add'),
    detail: z.object({ text: z.string() }),
  }),
  z.object({
    ...activityRow,
    action: z.literal('checklist.edit'),
    detail: z.object({ from: z.string(), to: z.string() }),
  }),
  z.object({
    ...activityRow,
    action: z.literal('checklist.tick'),
    detail: z.object({ text: z.string(), evidence: z.string().nullable() }),
  }),
  z.object({
    ...activityRow,
    action: z.literal('checklist.untick'),
    detail: z.object({ text: z.string() }),
  }),
  z.object({
    ...activityRow,
    action: z.literal('checklist.remove'),
    detail: z.object({ text: z.string() }),
  }),
  z.object({
    ...activityRow,
    action: z.literal('checklist.replace'),
    /** How many entries the new list has. */
    detail: z.object({ count: z.number().int() }),
  }),
]);
