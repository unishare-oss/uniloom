import { z } from 'zod';

/** How long a link works, in seconds. There is no "never" (ADR-0014). */
export const EXPIRY_SECONDS = {
  '1h': 3600,
  '24h': 24 * 3600,
  '7d': 7 * 24 * 3600,
  '30d': 30 * 24 * 3600,
} as const;

/** The server works out `expiresAt`, so a client can't send its own date. */
export const createInviteSchema = z.object({
  expiresIn: z.enum(['1h', '24h', '7d', '30d']),
  /** How many people the link lets in; null = no limit. */
  maxUses: z.number().int().min(1).max(100).nullable(),
  /** People ask to join and an owner or manager lets them in. Off = anyone joins. */
  joinApproval: z.boolean().default(false),
});

export const inviteSchema = z.object({
  /** The secret part of the link: /join/<token>. */
  token: z.string(),
  joinApproval: z.boolean(),
  maxUses: z.number().int().nullable(),
  useCount: z.number().int(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  /** The name of who made the link; null if their account is gone. */
  createdBy: z.string().nullable(),
  /** An expired or full link stays here until someone replaces or deletes it. */
  state: z.enum(['live', 'expired', 'full']),
});

/** What someone holding the link sees before joining. */
export const invitePreviewSchema = z.object({
  projectId: z.uuid(),
  projectName: z.string(),
  invitedBy: z.string().nullable(),
  /** Already in the project: the web app sends them straight to it. */
  isMember: z.boolean(),
  /** The link files a request instead of adding the person. */
  joinApproval: z.boolean(),
  /** The caller's waiting request for this project, if any. */
  request: z.enum(['PENDING']).nullable(),
});

export const joinResultSchema = z.object({
  /** `requested`: the link needs approval, so a request now waits. */
  result: z.enum(['joined', 'requested']),
  projectId: z.uuid(),
});

/** Someone waiting to be let in. */
export const joinRequestSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  /** When they last asked. */
  requestedAt: z.iso.datetime(),
});
