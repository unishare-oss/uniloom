import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  /** Items are numbered <keyPrefix>-<n>, e.g. UG-12. */
  keyPrefix: z.string().regex(/^[A-Z]{2,5}$/, '2 to 5 uppercase letters'),
  mode: z.enum(['STANDARD', 'GUIDED']),
});
