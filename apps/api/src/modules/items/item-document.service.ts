import { prisma } from '@/db/prisma.js';
import { apiError } from '@/http.js';
import type { DocumentKind } from '@/generated/prisma/enums.js';
import {
  addNumberedDocument,
  addTicketDocument,
  getDocument,
  loadDocument,
  validateSourceProposal,
} from '@/modules/documents/document.service.js';
import * as itemRules from './item.rules.js';
import * as itemDocumentRepo from './item-document.repository.js';
import { getItem, loadItem } from './item.service.js';

/**
 * The item when the person may change its documents: the project must be Guided (409
 * `guided_only`) and the ticket's edit rule must allow them (403).
 */
const loadEditableItem = async (itemId: string, userId: string) => {
  const { item, role } = await loadItem(itemId, userId);
  const guidedMessage = itemRules.guidedOnlyError(item.project);
  if (guidedMessage) throw apiError(409, 'guided_only', guidedMessage);
  const editMessage = itemRules.editError(
    item.project,
    role,
    userId,
    item.assigneeId,
  );
  if (editMessage) throw apiError(403, 'forbidden', editMessage);
  return item;
};

/** The Knowledge document of the item's project, or 404 for any other. */
const loadKnowledgeDocument = async (projectId: string, documentId: string) => {
  const document = await loadDocument(documentId);
  if (document.projectId !== projectId || document.homeItemId)
    throw apiError(404, 'not_found', 'Document not found');
  return document;
};

/**
 * Writes a spec or reference that belongs to the ticket. An ADR (Proposed) or tech debt
 * (Open) is a Knowledge document raised on the ticket: created and linked to it in one
 * transaction.
 */
export const createTicketDocument = async (
  itemId: string,
  userId: string,
  input: {
    kind: Extract<DocumentKind, 'SPEC' | 'REFERENCE' | 'ADR' | 'TECH_DEBT'>;
    title: string;
    purpose?: string;
    body?: string;
    sourceProposalId?: string | null;
  },
) => {
  const item = await loadEditableItem(itemId, userId);
  const { kind } = input;
  if (kind === 'ADR' || kind === 'TECH_DEBT') {
    await validateSourceProposal(item.projectId, kind, input.sourceProposalId);
    const record = await prisma.$transaction(async (tx) => {
      const created = await addNumberedDocument(
        tx,
        item.projectId,
        userId,
        kind,
        input,
        itemId,
      );
      await itemDocumentRepo.upsertLink(itemId, created.id, tx);
      return created;
    });
    return getDocument(record.id, userId);
  }
  return addTicketDocument(item.projectId, userId, itemId, input);
};

/** Links a Knowledge document to the ticket; linking twice changes nothing. */
export const linkDocument = async (
  itemId: string,
  userId: string,
  documentId: string,
) => {
  const item = await loadEditableItem(itemId, userId);
  const document = await loadKnowledgeDocument(item.projectId, documentId);
  if (document.archivedAt)
    throw apiError(
      409,
      'document_archived',
      "An archived document can't be linked",
    );
  await itemDocumentRepo.upsertLink(itemId, documentId);
  return getItem(itemId, userId);
};

export const unlinkDocument = async (
  itemId: string,
  userId: string,
  documentId: string,
) => {
  const item = await loadEditableItem(itemId, userId);
  await loadKnowledgeDocument(item.projectId, documentId);
  await itemDocumentRepo.deleteLink(itemId, documentId);
};
