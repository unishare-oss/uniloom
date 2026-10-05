import { z } from 'zod';
import { Role } from '@/generated/prisma/enums.js';

const roleSchema = z.enum(Role);

export const addMemberSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: roleSchema,
});

export const changeRoleSchema = z.object({ role: roleSchema });

export const memberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: roleSchema,
  createdAt: z.iso.datetime(),
});
