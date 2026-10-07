import { z } from 'zod';
import { Role } from '@/generated/prisma/enums.js';

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  /** Items are numbered <keyPrefix>-<n>, e.g. UG-12. */
  keyPrefix: z.string().regex(/^[A-Z]{2,5}$/, '2 to 5 uppercase letters'),
  mode: z.enum(['STANDARD', 'GUIDED']),
});

/** Every field optional; checklist limits are whole numbers, or null for no limit (the service refuses below 1). */
export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  checklistRequired: z.boolean().optional(),
  checklistMin: z.number().int().nullable().optional(),
  checklistMax: z.number().int().nullable().optional(),
  designRequired: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
  approverNotAuthor: z.boolean().optional(),
  plannedVsActual: z.boolean().optional(),
  selfClaimAllowed: z.boolean().optional(),
});

export const projectSchema = z.object({
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
  /** When off, members can't claim a free ticket (they can still unclaim their own). */
  selfClaimAllowed: z.boolean(),
  nextItemNumber: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const stateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** Stable key in Guided projects (`ready`, `in_review`, ...); null in Standard. */
  key: z.string().nullable(),
  category: z.enum(['BACKLOG', 'UNSTARTED', 'STARTED', 'DONE', 'CANCELED']),
  position: z.number().int(),
});

/** A project with its states in board order and what the caller may do in it. */
export const projectDetailSchema = projectSchema.extend({
  states: z.array(stateSchema),
  role: z.enum(Role),
  /** Whether the caller may add, change or remove members (owners). */
  canManageMembers: z.boolean(),
  /** Whether the caller may create, delete and restore items (owners, managers). */
  canCreateItems: z.boolean(),
  /** Whether the caller may set anyone as a ticket's assignee (owners, managers). */
  canAssignOthers: z.boolean(),
  /** Whether the caller may change the project's name, switches and limits (owners). */
  canEditSettings: z.boolean(),
  /** Whether the caller may add labels and change their name and colour (owners, managers). */
  canCreateLabels: z.boolean(),
  /** Whether the caller may claim a free ticket (owners, managers, or members when self-claim is on). */
  canClaim: z.boolean(),
  /** Whether the caller may move a ticket into a Done state (owners, managers). */
  canMoveToDone: z.boolean(),
  /** The roles the caller may give when adding a member. */
  assignableRoles: z.array(z.enum(Role)),
});
