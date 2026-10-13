import type { LinkState } from './invite.types.js';

/**
 * Whether a link still lets people in. Revoked wins over expired, and expired over full,
 * so a dead link always gives the same answer.
 */
export const linkState = (
  invite: {
    revokedAt: Date | null;
    expiresAt: Date;
    maxUses: number | null;
    useCount: number;
  },
  now: Date,
): LinkState => {
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt <= now) return 'expired';
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses)
    return 'full';
  return 'live';
};
