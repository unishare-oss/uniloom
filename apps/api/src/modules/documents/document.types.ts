import type { Document } from '@/generated/prisma/client.js';

/** A document row with its author's public fields. */
export type DocumentRow = Document & {
  author: { id: string; name: string; image: string | null } | null;
};
