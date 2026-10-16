import { toCommentTree } from './comment.utils.js';
import type { CommentRow } from './comment.types.js';

const row = (id: string, extra: Partial<CommentRow> = {}) => {
  return {
    id,
    projectId: 'p',
    itemId: 'i',
    documentId: null,
    parentId: null,
    authorId: 'a',
    author: { id: 'a', name: 'Ann', image: null },
    body: `body ${id}`,
    editedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-10-16T10:00:00Z'),
    ...extra,
  } as CommentRow;
};

const viewer = (userId: string, role: 'OWNER' | 'MANAGER' | 'MEMBER') => {
  return { userId, role, targetAuthorId: 'a' };
};

describe('toCommentTree', () => {
  it('nests replies under their parent and counts live comments', () => {
    const tree = toCommentTree(
      [
        row('1'),
        row('2', { parentId: '1' }),
        row('3', { parentId: '2' }),
        row('4'),
      ],
      viewer('x', 'MEMBER'),
    );
    expect(tree.comments.map((c) => c.id)).toEqual(['1', '4']);
    expect(tree.comments[0].replies[0].replies[0].id).toBe('3');
    expect(tree.count).toBe(4);
  });

  it('blanks a deleted comment, keeps its replies and leaves it out of the count', () => {
    const tree = toCommentTree(
      [row('1', { deletedAt: new Date() }), row('2', { parentId: '1' })],
      viewer('a', 'OWNER'),
    );
    const [deleted] = tree.comments;
    expect(deleted).toMatchObject({
      body: '',
      author: null,
      deleted: true,
      canEdit: false,
      canDelete: false,
    });
    expect(deleted.replies).toHaveLength(1);
    expect(tree.count).toBe(1);
  });

  it('lets the author edit and delete, a manager only delete, a member neither', () => {
    const own = toCommentTree([row('1')], viewer('a', 'MEMBER')).comments[0];
    expect([own.canEdit, own.canDelete]).toEqual([true, true]);
    const manager = toCommentTree([row('1')], viewer('m', 'MANAGER'))
      .comments[0];
    expect([manager.canEdit, manager.canDelete]).toEqual([false, true]);
    const member = toCommentTree([row('1')], viewer('m', 'MEMBER')).comments[0];
    expect([member.canEdit, member.canDelete]).toEqual([false, false]);
  });

  it('marks the ticket creator and shows edited only from editedAt', () => {
    const edited = new Date('2026-10-16T11:00:00Z');
    const [c] = toCommentTree(
      [row('1', { editedAt: edited })],
      viewer('x', 'MEMBER'),
    ).comments;
    expect(c.isTargetAuthor).toBe(true);
    expect(c.editedAt).toBe(edited.toISOString());
  });
});
