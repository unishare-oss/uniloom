export type LinkState = 'live' | 'expired' | 'full' | 'revoked';

/** An invite row with the name of who made it. */
export interface InviteRow {
  id: string;
  projectId: string;
  token: string;
  joinApproval: boolean;
  maxUses: number | null;
  useCount: number;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
  createdBy: { name: string } | null;
}
