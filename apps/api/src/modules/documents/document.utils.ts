import { apiError } from '@/http.js';
import { isArchivable } from './document.rules.js';
import type {
  DocumentEdit,
  DocumentRow,
  SummaryRow,
} from './document.types.js';

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
    sourceProposalId: row.sourceProposalId,
    sourceProposal: row.sourceProposal,
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
    derivedSpecs: row.derivedSpecs.map((spec) => ({
      id: spec.id,
      title: spec.title,
      homeItem: ticketRef(spec.homeItem),
    })),
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

/**
 * Swaps each edit's `old` text for its `new` text, in order, on one string. Each `old` must
 * occur exactly once in the text as it is then (case and whitespace exact); otherwise
 * `edit_mismatch` names the edit and how many matches it had. Slices instead of
 * `String.replace`, so `$&` in `new` stays literal.
 */
export const applyEdits = (body: string, edits: DocumentEdit[]) => {
  let text = body;
  for (const [index, edit] of edits.entries()) {
    let count = 0;
    let at = text.indexOf(edit.old);
    const first = at;
    while (at !== -1) {
      count += 1;
      at = text.indexOf(edit.old, at + 1);
    }
    if (count !== 1)
      throw apiError(
        400,
        'edit_mismatch',
        `Edit ${index + 1}: old text matched ${count} times, it must match exactly once. ${count === 0 ? 'Check the text, case and whitespace' : 'Add surrounding text to make it unique'}`,
      );
    text =
      text.slice(0, first) + edit.new + text.slice(first + edit.old.length);
  }
  return text;
};
