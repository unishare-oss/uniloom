export const MAX_COMMENT_LENGTH = 2000;

/** Why a comment body (trimmed first) can't be saved, or null when it can. */
export const commentError = (body: string) => {
  const text = body.trim();
  if (text.length === 0) return 'empty_comment';
  if (text.length > MAX_COMMENT_LENGTH) return 'comment_too_long';
  return null;
};
