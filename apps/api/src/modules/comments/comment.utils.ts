import { CREATORS } from '@/modules/members/member.service.js';
import type {
  CommentNode,
  CommentRow,
  CommentViewer,
} from './comment.types.js';

/**
 * Builds the nested tree from flat rows (oldest first). A deleted comment stays as a
 * placeholder without body or author, so its replies keep their place. The buttons come from
 * `canEdit` and `canDelete`; the web app makes no role check of its own.
 */
export const toCommentTree = (rows: CommentRow[], viewer: CommentViewer) => {
  const nodes = new Map<string, CommentNode>();
  for (const row of rows) {
    const deleted = row.deletedAt !== null;
    const mine = row.authorId === viewer.userId;
    nodes.set(row.id, {
      id: row.id,
      body: deleted ? '' : row.body,
      author:
        deleted || !row.author
          ? null
          : {
              id: row.author.id,
              name: row.author.name,
              image: row.author.image,
            },
      isTargetAuthor:
        !deleted &&
        row.authorId !== null &&
        row.authorId === viewer.targetAuthorId,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      deleted,
      canEdit: !deleted && mine,
      canDelete: !deleted && (mine || CREATORS.includes(viewer.role)),
      replies: [],
    });
  }

  const roots: CommentNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  return {
    count: rows.filter((row) => row.deletedAt === null).length,
    comments: roots,
  };
};
