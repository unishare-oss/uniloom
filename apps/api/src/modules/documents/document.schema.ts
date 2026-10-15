import { z } from 'zod';
import { DocumentKind, DocumentStatus } from '@/generated/prisma/enums.js';

const kind = z.enum(DocumentKind);
export const status = z.enum(DocumentStatus);
const title = z.string().trim().min(1).max(200);
const purpose = z.string().trim().max(300);
const body = z.string().max(100_000);

export const createDocumentSchema = z.object({
  kind,
  title,
  purpose: purpose.optional(),
  body: body.optional(),
  sourceProposalId: z.uuid().nullable().optional(),
});

/** Every field optional; `archived` sets or clears `archivedAt`. The kind never changes. */
export const updateDocumentSchema = z.object({
  title: title.optional(),
  purpose: purpose.optional(),
  body: body.optional(),
  sourceProposalId: z.uuid().nullable().optional(),
  archived: z.boolean().optional(),
});

/**
 * `supersededById` names the newer ADR when `status` is SUPERSEDED; `fixedByItemId` names
 * the Done ticket when tech debt is FIXED.
 */
export const setDocumentStatusSchema = z.object({
  status,
  supersededById: z.uuid().optional(),
  fixedByItemId: z.uuid().optional(),
});

/** Query strings: `archived=true` includes archived documents. */
export const listDocumentsQuerySchema = z.object({
  kind: kind.optional(),
  q: z.string().trim().max(200).optional(),
  archived: z.enum(['true', 'false']).optional(),
  /** `true` also lists documents that belong to a ticket (hidden from Knowledge by default). */
  includeTicketDocuments: z.enum(['true', 'false']).optional(),
});

const authorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  })
  .nullable();

/** A row of the list: no body. */
export const documentSummarySchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  kind,
  /** ADR-7: per project and kind; null for kinds without a number. */
  number: z.number().int().nullable(),
  status: status.nullable(),
  title: z.string(),
  purpose: z.string(),
  author: authorSchema,
  archivedAt: z.iso.datetime().nullable(),
  /** Set: the document belongs to that ticket (a feature's spec), not to Knowledge. */
  homeItemId: z.uuid().nullable(),
  sourceProposalId: z.uuid().nullable(),
  sourceProposal: z
    .object({
      id: z.uuid(),
      title: z.string(),
      archivedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
  canEdit: z.boolean(),
  /** The ticket it was raised on (a deleted ticket reads as null). */
  createdFrom: z.object({ id: z.uuid(), key: z.string() }).nullable(),
  /** The ticket that fixed a tech debt record (a deleted ticket reads as null). */
  fixedBy: z.object({ id: z.uuid(), key: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const documentSchema = documentSummarySchema.extend({
  body: z.string(),
  derivedSpecs: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      homeItem: z.object({ id: z.uuid(), key: z.string() }).nullable(),
    }),
  ),
  /** The newer ADR that replaced this one. */
  supersededBy: z
    .object({
      id: z.uuid(),
      number: z.number().int().nullable(),
      title: z.string(),
    })
    .nullable(),
  /** The ticket it belongs to, for a ticket document. */
  homeItem: z
    .object({ id: z.uuid(), key: z.string(), title: z.string() })
    .nullable(),
  /** False for ADRs and tech debt: they are closed by status, not archived. */
  canArchive: z.boolean(),
  /** The tickets a Knowledge document is linked to. */
  items: z.array(
    z.object({
      id: z.uuid(),
      key: z.string(),
      title: z.string(),
      state: z.object({
        name: z.string(),
        category: z.enum([
          'BACKLOG',
          'UNSTARTED',
          'STARTED',
          'DONE',
          'CANCELED',
        ]),
      }),
    }),
  ),
});
