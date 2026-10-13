import { isArchivable } from './document.rules.js';
import type { DocumentRow, SummaryRow } from './document.types.js';

/** A ticket's key as people read it: TG-12. */
const keyOf = (item: { number: number; project: { keyPrefix: string } }) =>
  `${item.project.keyPrefix}-${item.number}`;

/** A ticket as `{ id, key }`; null when there is none or it has been deleted. */
const ticketRef = (
  item: {
    id: string;
    number: number;
    deletedAt: Date | null;
    project: { keyPrefix: string };
  } | null,
) => {
  if (!item || item.deletedAt) return null;
  return { id: item.id, key: keyOf(item) };
};

/** A list row, without the body. `canEdit` is the service's answer. */
export const toDocumentSummary = (row: SummaryRow, canEdit: boolean) => {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind,
    number: row.number,
    status: row.status,
    title: row.title,
    purpose: row.purpose,
    author: row.author,
    archivedAt: row.archivedAt,
    homeItemId: row.homeItemId,
    canEdit,
    createdFrom: ticketRef(row.createdFromItem),
    fixedBy: ticketRef(row.fixedByItem),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/** One document, as the API returns it. */
export const toDocument = (row: DocumentRow, canEdit: boolean) => {
  return {
    ...toDocumentSummary(row, canEdit),
    body: row.body,
    supersededBy: row.supersededBy,
    homeItem: row.homeItem && {
      id: row.homeItem.id,
      key: keyOf(row.homeItem),
      title: row.homeItem.title,
    },
    canArchive: isArchivable(row.kind),
    items: row.links.map((link) => ({
      id: link.item.id,
      key: keyOf(link.item),
      title: link.item.title,
      state: link.item.state,
    })),
  };
};
