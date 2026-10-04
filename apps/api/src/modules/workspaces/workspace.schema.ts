import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  /** Items are numbered <keyPrefix>-<n>, e.g. UG-12. */
  keyPrefix: z.string().regex(/^[A-Z]{2,5}$/, '2 to 5 uppercase letters'),
  mode: z.enum(['STANDARD', 'GUIDED']),
});

export const workspaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  keyPrefix: z.string(),
  mode: z.enum(['STANDARD', 'GUIDED']),
  checklistRequired: z.boolean(),
  checklistMin: z.number().int().nullable(),
  checklistMax: z.number().int().nullable(),
  designRequired: z.boolean(),
  approvalRequired: z.boolean(),
  approverNotAuthor: z.boolean(),
  plannedVsActual: z.boolean(),
  nextItemNumber: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
