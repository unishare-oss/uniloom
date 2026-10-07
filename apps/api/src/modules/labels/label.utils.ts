import type { Label } from '@/generated/prisma/client.js';

/** One label, as the API returns it. */
export const toLabel = (row: Label) => {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    color: row.color,
    group: row.group,
    createdAt: row.createdAt,
  };
};
