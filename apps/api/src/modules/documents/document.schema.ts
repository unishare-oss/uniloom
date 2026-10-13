import { z } from 'zod';
import { DocumentKind } from '@/generated/prisma/enums.js';

const kind = z.enum(DocumentKind);
const title = z.string().trim().min(1).max(200);
const purpose = z.string().trim().max(300);
const body = z.string().max(100_000);

export const createDocumentSchema = z.object({
  kind,
  title,
  purpose: purpose.optional(),
  body: body.optional(),
});

/** Every field optional; `archived` sets or clears `archivedAt`. The kind never changes. */
export const updateDocumentSchema = z.object({
  title: title.optional(),
  purpose: purpose.optional(),
  body: body.optional(),
  archived: z.boolean().optional(),
});

/** Query strings: `archived=true` includes archived documents. */
export const listDocumentsQuerySchema = z.object({
  kind: kind.optional(),
  q: z.string().trim().max(200).optional(),
  archived: z.enum(['true', 'false']).optional(),
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
  title: z.string(),
  purpose: z.string(),
  author: authorSchema,
  archivedAt: z.iso.datetime().nullable(),
  canEdit: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const documentSchema = documentSummarySchema.extend({
  body: z.string(),
});
