import { randomBytes } from 'node:crypto';
import { linkState } from './invite.rules.js';
import type { InviteRow } from './invite.types.js';

/** 32 random bytes as base64url: 43 characters, safe in a URL path. */
export const newToken = () => randomBytes(32).toString('base64url');

/** The link as owners and managers see it, token included. */
export const view = (invite: InviteRow, now: Date) => ({
  token: invite.token,
  joinApproval: invite.joinApproval,
  maxUses: invite.maxUses,
  useCount: invite.useCount,
  expiresAt: invite.expiresAt,
  createdAt: invite.createdAt,
  createdBy: invite.createdBy?.name ?? null,
  state: linkState(invite, now),
});
