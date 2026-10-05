import { z } from 'zod';

export const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  name: z.string(),
  image: z.string().nullable(),
  consentGivenAt: z.iso.datetime().nullable(),
});

export const consentSchema = z.object({ consentGivenAt: z.iso.datetime() });
