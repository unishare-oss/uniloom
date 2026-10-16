import { apiError } from '@/http.js';
import { loadDocument } from '@/modules/documents/document.service.js';
import { loadItem } from '@/modules/items/item.service.js';
import {
  CREATORS,
  requireRole,
  ROLES,
} from '@/modules/members/member.service.js';
import * as commentRepo from './comment.repository.js';
import { commentError } from './comment.rules.js';
import { toCommentTree } from './comment.utils.js';

const checkBody = (body: string) => {
  const code = commentError(body);
  if (code === 'empty_comment')
    throw apiError(400, code, 'Write something first');
  if (code === 'comment_too_long')
    throw apiError(400, code, 'A comment can be at most 2000 characters');
  return body.trim();
};

/** The comment as the caller sees it: one node, no replies. */
const toNode = (
  row: Awaited<ReturnType<typeof commentRepo.insertComment>>,
  viewer: { userId: string; role: Parameters<typeof toCommentTree>[1]['role'] },
  targetAuthorId: string | null,
) => {
  return toCommentTree([row], { ...viewer, targetAuthorId }).comments[0];
};

/** The whole tree of comments on a ticket, with the live count. Any member may read. */
export const listItemComments = async (itemId: string, userId: string) => {
  const { item, role } = await loadItem(itemId, userId);
  const rows = await commentRepo.findComments({ itemId });
  return toCommentTree(rows, {
    userId,
    role,
    targetAuthorId: item.createdById,
  });
};

/** Adds a comment, or a reply when `parentId` is a live comment on the same ticket. */
export const createItemComment = async (
  itemId: string,
  userId: string,
  input: { body: string; parentId?: string | null },
) => {
  const { item, role } = await loadItem(itemId, userId);
  const body = checkBody(input.body);
  if (input.parentId) {
    const parent = await commentRepo.findLiveComment(input.parentId);
    if (!parent || parent.itemId !== itemId)
      throw apiError(404, 'not_found', 'Comment not found');
  }
  const row = await commentRepo.insertComment({
    projectId: item.projectId,
    itemId,
    parentId: input.parentId ?? null,
    authorId: userId,
    body,
  });
  return toNode(row, { userId, role }, item.createdById);
};

/**
 * The document and the caller's role. Any member; a ticket-owned document also needs its
 * ticket to be live and visible, as `getDocument` does.
 */
const loadDocumentForComments = async (documentId: string, userId: string) => {
  const document = await loadDocument(documentId);
  const { role } = await requireRole(document.projectId, userId, ROLES);
  if (document.homeItemId) await loadItem(document.homeItemId, userId);
  return { document, role };
};

/** The whole tree of comments on a document, with the live count. */
export const listDocumentComments = async (
  documentId: string,
  userId: string,
) => {
  const { document, role } = await loadDocumentForComments(documentId, userId);
  const rows = await commentRepo.findComments({ documentId });
  return toCommentTree(rows, {
    userId,
    role,
    targetAuthorId: document.authorId,
  });
};

/** Adds a comment, or a reply when `parentId` is a live comment on the same document. */
export const createDocumentComment = async (
  documentId: string,
  userId: string,
  input: { body: string; parentId?: string | null },
) => {
  const { document, role } = await loadDocumentForComments(documentId, userId);
  const body = checkBody(input.body);
  if (input.parentId) {
    const parent = await commentRepo.findLiveComment(input.parentId);
    if (!parent || parent.documentId !== documentId)
      throw apiError(404, 'not_found', 'Comment not found');
  }
  const row = await commentRepo.insertComment({
    projectId: document.projectId,
    documentId,
    parentId: input.parentId ?? null,
    authorId: userId,
    body,
  });
  return toNode(row, { userId, role }, document.authorId);
};

/** A live comment on a live ticket, or 404 (also for a non-member of its project). */
const loadComment = async (id: string, userId: string) => {
  const comment = await commentRepo.findLiveComment(id);
  if (
    !comment ||
    comment.item?.deletedAt ||
    comment.document?.homeItem?.deletedAt
  )
    throw apiError(404, 'not_found', 'Comment not found');
  const member = await requireRole(comment.projectId, userId, ROLES);
  return { comment, role: member.role };
};

/** Only the author edits; sets `editedAt`. */
export const updateComment = async (
  id: string,
  userId: string,
  input: { body: string },
) => {
  const { comment, role } = await loadComment(id, userId);
  if (comment.authorId !== userId)
    throw apiError(403, 'forbidden', 'Only the author can edit a comment');
  const body = checkBody(input.body);
  const row = await commentRepo.updateCommentRow(id, {
    body,
    editedAt: new Date(),
  });
  return toNode(
    row,
    { userId, role },
    comment.item?.createdById ?? comment.document?.authorId ?? null,
  );
};

/** The author, an Owner or a Manager deletes. The row stays so replies keep their place. */
export const deleteComment = async (id: string, userId: string) => {
  const { comment, role } = await loadComment(id, userId);
  if (comment.authorId !== userId && !CREATORS.includes(role))
    throw apiError(403, 'forbidden', 'Your role cannot delete this comment');
  await commentRepo.updateCommentRow(id, { deletedAt: new Date() });
};
