import type { DocumentRow } from './document.types.js';

/** A list row, without the body. `canEdit` is the service's answer. */
export const toDocumentSummary = (
  row: Omit<DocumentRow, 'body'>,
  canEdit: boolean,
) => {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind,
    title: row.title,
    purpose: row.purpose,
    author: row.author,
    archivedAt: row.archivedAt,
    canEdit,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/** One document, as the API returns it. */
export const toDocument = (row: DocumentRow, canEdit: boolean) => {
  return { ...toDocumentSummary(row, canEdit), body: row.body };
};
