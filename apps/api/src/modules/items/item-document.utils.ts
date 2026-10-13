import type { findItemDocuments } from './item-document.repository.js';

type DocumentRow = Awaited<ReturnType<typeof findItemDocuments>>[number];

/**
 * The item page's Related list. A document the item owns or is linked to has `from` null;
 * one reached only through the parent carries the parent's key (read only).
 */
export const toRelated = (
  rows: DocumentRow[],
  itemId: string,
  parentKey: string | null,
) => {
  return rows.map((row) => {
    const own =
      row.homeItemId === itemId ||
      row.links.some((link) => link.itemId === itemId);
    return {
      id: row.id,
      kind: row.kind,
      number: row.number,
      status: row.status,
      title: row.title,
      archived: row.archivedAt !== null,
      home: row.homeItemId ? ('ticket' as const) : ('project' as const),
      from: own ? null : parentKey,
    };
  });
};
