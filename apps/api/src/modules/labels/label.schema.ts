import { z } from 'zod';
import { LabelColor } from '@/generated/prisma/enums.js';

const name = z.string().trim().min(1).max(50);
const color = z.enum(LabelColor);
const group = z.string().trim().min(1).max(50);

export const createLabelSchema = z.object({
  name,
  color,
  group: group.nullish(),
});

/** Every field optional; null clears the group. */
export const updateLabelSchema = z.object({
  name: name.optional(),
  color: color.optional(),
  group: group.nullable().optional(),
});

export const labelSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  color,
  /** Two labels of one group can't be on the same item; null combines freely. */
  group: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
