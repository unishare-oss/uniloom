import { apiError } from '@/http.js';
import type { DocumentKind } from '@/generated/prisma/enums.js';
import {
  CREATORS,
  requireRole,
  ROLES,
} from '@/modules/members/member.service.js';
import * as documentRepo from './document.repository.js';
import { toDocument, toDocumentSummary } from './document.utils.js';

/** The document, or 404 when it doesn't exist. */
const loadDocument = async (id: string) => {
  const document = await documentRepo.findDocument(id);
  if (!document) throw apiError(404, 'not_found', 'Document not found');
  return document;
};

/** Owners and managers create; the caller becomes the author. */
export const createDocument = async (
  projectId: string,
  userId: string,
  input: { kind: DocumentKind; title: string; purpose?: string; body?: string },
) => {
  await requireRole(projectId, userId, CREATORS);
  const document = await documentRepo.insertDocument({
    projectId,
    authorId: userId,
    ...input,
  });
  return toDocument(document, true);
};

/** Summaries without bodies, newest edit first. Any member may ask. */
export const listDocuments = async (
  projectId: string,
  userId: string,
  query: { kind?: DocumentKind; q?: string; archived?: 'true' | 'false' },
) => {
  const { role } = await requireRole(projectId, userId, ROLES);
  const documents = await documentRepo.findDocuments(projectId, {
    kind: query.kind,
    q: query.q,
    archived: query.archived === 'true',
  });
  return documents.map((document) =>
    toDocumentSummary(
      document,
      CREATORS.includes(role) || document.authorId === userId,
    ),
  );
};

/** Any member; a non-member gets the same 404 as a missing document. */
export const getDocument = async (id: string, userId: string) => {
  const document = await loadDocument(id);
  const { role } = await requireRole(document.projectId, userId, ROLES);
  return toDocument(
    document,
    CREATORS.includes(role) || document.authorId === userId,
  );
};

/** The author, an Owner or a Manager; `archived` sets or clears `archivedAt`. */
export const updateDocumentById = async (
  id: string,
  userId: string,
  input: {
    title?: string;
    purpose?: string;
    body?: string;
    archived?: boolean;
  },
) => {
  const document = await loadDocument(id);
  const { role } = await requireRole(document.projectId, userId, ROLES);
  if (!CREATORS.includes(role) && document.authorId !== userId)
    throw apiError(403, 'forbidden', 'Only the author or a manager can edit');
  const { archived, ...fields } = input;
  const updated = await documentRepo.updateDocument(id, {
    ...fields,
    ...(archived !== undefined && {
      archivedAt: archived ? (document.archivedAt ?? new Date()) : null,
    }),
  });
  return toDocument(updated, true);
};
