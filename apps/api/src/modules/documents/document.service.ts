import { prisma } from '@/db/prisma.js';
import { apiError } from '@/http.js';
import type { Prisma } from '@/generated/prisma/client.js';
import type { DocumentKind, DocumentStatus } from '@/generated/prisma/enums.js';
import {
  CREATORS,
  requireRole,
  ROLES,
} from '@/modules/members/member.service.js';
import { loadItem } from '@/modules/items/item.service.js';
import {
  editError,
  guidedOnlyError,
  mayEdit,
} from '@/modules/items/item.rules.js';
import { requireMember } from '@/modules/projects/project.service.js';
import * as documentRepo from './document.repository.js';
import { nextStatusError } from './document.rules.js';
import { toDocument, toDocumentSummary } from './document.utils.js';

/** The document, or 404 when it doesn't exist. */
export const loadDocument = async (id: string) => {
  const document = await documentRepo.findDocument(id);
  // A ticket document goes with its ticket: once that is deleted it is gone too.
  if (!document || document.homeItem?.deletedAt)
    throw apiError(404, 'not_found', 'Document not found');
  return document;
};

/**
 * A numbered record (an ADR, starting Proposed, or tech debt, starting Open) with the
 * project's next number for its kind, authored by `userId`. `createdFromItemId` is the
 * ticket it was raised on, if any. Call it in a transaction.
 */
export const addNumberedDocument = async (
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
  kind: 'ADR' | 'TECH_DEBT',
  input: { title: string; purpose?: string; body?: string },
  createdFromItemId?: string,
) => {
  const number = await documentRepo.nextDocumentNumber(tx, projectId, kind);
  return documentRepo.insertDocument(
    {
      projectId,
      authorId: userId,
      kind,
      number,
      status: kind === 'ADR' ? 'PROPOSED' : 'OPEN',
      createdFromItemId,
      title: input.title,
      purpose: input.purpose,
      body: input.body,
    },
    tx,
  );
};

/** Owners and managers create; the caller becomes the author. An ADR starts Proposed. Tech debt is raised from a ticket instead. */
export const createDocument = async (
  projectId: string,
  userId: string,
  input: { kind: DocumentKind; title: string; purpose?: string; body?: string },
) => {
  await requireRole(projectId, userId, CREATORS);
  if (input.kind === 'TECH_DEBT')
    throw apiError(
      409,
      'raise_from_ticket',
      'Tech debt is raised from the ticket where it was found',
    );
  if (input.kind === 'ADR') {
    const project = await requireMember(projectId, userId);
    const message = guidedOnlyError(project);
    if (message) throw apiError(409, 'guided_only', message);
    const adr = await prisma.$transaction((tx) =>
      addNumberedDocument(tx, projectId, userId, 'ADR', input),
    );
    return toDocument(adr, true);
  }
  const document = await documentRepo.insertDocument({
    projectId,
    authorId: userId,
    ...input,
  });
  return toDocument(document, true);
};

/** A ticket's document, written from that ticket; the caller becomes the author. */
export const addTicketDocument = async (
  projectId: string,
  userId: string,
  itemId: string,
  input: { kind: DocumentKind; title: string; purpose?: string; body?: string },
) => {
  const document = await documentRepo.insertDocument({
    projectId,
    authorId: userId,
    homeItemId: itemId,
    createdFromItemId: itemId,
    ...input,
  });
  return toDocument(document, true);
};

/** Summaries without bodies, newest edit first. Any member may ask. */
export const listDocuments = async (
  projectId: string,
  userId: string,
  query: {
    kind?: DocumentKind;
    q?: string;
    archived?: 'true' | 'false';
    includeTicketDocuments?: 'true' | 'false';
  },
) => {
  const { role } = await requireRole(projectId, userId, ROLES);
  const documents = await documentRepo.findDocuments(projectId, {
    kind: query.kind,
    q: query.q,
    archived: query.archived === 'true',
    includeTicketDocuments: query.includeTicketDocuments === 'true',
  });
  // A ticket document follows its ticket's edit rule, any other the current role.
  return documents.map((document) =>
    toDocumentSummary(
      document,
      document.homeItem
        ? mayEdit(role, userId, document.homeItem.assigneeId)
        : CREATORS.includes(role),
    ),
  );
};

/** Any member; a non-member gets the same 404 as a missing document. */
export const getDocument = async (id: string, userId: string) => {
  const document = await loadDocument(id);
  const { role } = await requireRole(document.projectId, userId, ROLES);
  if (!document.homeItemId)
    return toDocument(document, CREATORS.includes(role));
  const { item } = await loadItem(document.homeItemId, userId);
  return toDocument(document, mayEdit(role, userId, item.assigneeId));
};

/**
 * A ticket document follows the ticket's edit rule (`editError`); any other document needs
 * an owner or manager, by their current role (not who wrote it). `archived` sets or clears
 * `archivedAt`.
 */
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
  if (document.homeItemId) {
    const { item, role } = await loadItem(document.homeItemId, userId);
    const message = editError(item.project, role, userId, item.assigneeId);
    if (message) throw apiError(403, 'forbidden', message);
  } else {
    await requireRole(document.projectId, userId, CREATORS);
  }
  const { archived, ...fields } = input;
  if (archived && document.kind === 'ADR')
    throw apiError(
      409,
      'adr_not_archivable',
      'An ADR is never archived: supersede it instead',
    );
  if (archived && document.kind === 'TECH_DEBT')
    throw apiError(
      409,
      'tech_debt_not_archivable',
      "Tech debt is never archived: mark it Fixed or Won't fix instead",
    );
  const updated = await documentRepo.updateDocument(id, {
    ...fields,
    ...(archived !== undefined && {
      archivedAt: archived ? (document.archivedAt ?? new Date()) : null,
    }),
  });
  return toDocument(updated, true);
};

/**
 * Moves an ADR or tech debt record to its next status. Owners and managers only, by their
 * current role. Superseding names a newer Accepted ADR of the same project; Fixing names a
 * Done ticket of the same project, which is stored and linked. The write only applies if
 * the status is still the one read here, so two moves at once can't both win (409).
 */
export const setDocumentStatus = async (
  id: string,
  userId: string,
  input: {
    status: DocumentStatus;
    supersededById?: string;
    fixedByItemId?: string;
  },
) => {
  const document = await loadDocument(id);
  await requireRole(document.projectId, userId, CREATORS);
  const message = nextStatusError(document.kind, document.status, input.status);
  if (message) throw apiError(409, 'invalid_status', message);
  if (input.status !== 'SUPERSEDED' && input.supersededById)
    throw apiError(
      409,
      'invalid_status',
      'Only a superseded ADR names a newer one',
    );
  if (input.status !== 'FIXED' && input.fixedByItemId)
    throw apiError(
      409,
      'invalid_status',
      'Only fixed tech debt names the ticket that fixed it',
    );
  if (input.status === 'SUPERSEDED') {
    const newer = input.supersededById
      ? await documentRepo.findDocument(input.supersededById)
      : null;
    if (
      !newer ||
      newer.projectId !== document.projectId ||
      newer.kind !== 'ADR' ||
      newer.status !== 'ACCEPTED' ||
      newer.number === null ||
      document.number === null ||
      newer.number <= document.number
    )
      throw apiError(
        409,
        'invalid_status',
        'Name a newer Accepted ADR of this project',
      );
  }
  if (input.status === 'FIXED') {
    const fixer = input.fixedByItemId
      ? await loadItem(input.fixedByItemId, userId)
      : null;
    if (
      !fixer ||
      fixer.item.projectId !== document.projectId ||
      fixer.item.state.category !== 'DONE'
    )
      throw apiError(
        409,
        'fix_not_done',
        'Name a Done ticket of this project that fixed it',
      );
  }
  const changed = await prisma.$transaction(async (tx) => {
    const count = await documentRepo.moveDocumentStatus(
      tx,
      id,
      document.status,
      {
        status: input.status,
        supersededById: input.supersededById ?? null,
        fixedByItemId: input.fixedByItemId ?? null,
      },
    );
    if (count === 1 && input.fixedByItemId)
      await documentRepo.linkItem(tx, input.fixedByItemId, id);
    return count === 1;
  });
  if (!changed)
    throw apiError(
      409,
      'invalid_status',
      'The status was changed by someone else: reload and try again',
    );
  return toDocument(await loadDocument(id), true);
};
