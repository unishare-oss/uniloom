import type { Role } from '@/generated/prisma/enums.js';
import type { findComments } from './comment.repository.js';

export type CommentRow = Awaited<ReturnType<typeof findComments>>[number];

/** Who is reading a thread and who started its ticket, to decide the buttons. */
export interface CommentViewer {
  userId: string;
  role: Role;
  /** The ticket's creator: gets the Author badge. */
  targetAuthorId: string | null;
}

export interface CommentNode {
  id: string;
  /** Empty for a deleted comment. */
  body: string;
  /** Null for a deleted comment or when the person's account is gone. */
  author: { id: string; name: string; image: string | null } | null;
  mentions: { id: string; name: string }[];
  isTargetAuthor: boolean;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  canEdit: boolean;
  canDelete: boolean;
  replies: CommentNode[];
}
