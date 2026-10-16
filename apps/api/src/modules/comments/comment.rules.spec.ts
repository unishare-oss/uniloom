import { commentError } from './comment.rules.js';

describe('commentError', () => {
  it('refuses an empty or whitespace-only body', () => {
    expect(commentError('')).toBe('empty_comment');
    expect(commentError('  \n\t ')).toBe('empty_comment');
  });

  it('refuses a body over 2000 characters, counted after trimming', () => {
    expect(commentError('a'.repeat(2001))).toBe('comment_too_long');
    expect(commentError(`  ${'a'.repeat(2000)}  `)).toBeNull();
  });

  it('accepts a normal body', () => {
    expect(commentError('Looks good')).toBeNull();
  });
});
