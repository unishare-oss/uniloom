import { z } from 'zod';

/** The length and blank checks are a rule (`commentError`), so they answer their own codes. */
export const createCommentSchema = z.object({
  body: z.string(),
  /** The comment this one replies to, on the same ticket. */
  parentId: z.uuid().nullish(),
});

export const updateCommentSchema = z.object({ body: z.string() });

export const commentSchema = z
  .object({
    id: z.uuid(),
    /** Empty for a deleted comment. */
    body: z.string(),
    /** Null for a deleted comment or when the person's account is gone. */
    author: z
      .object({
        id: z.string(),
        name: z.string(),
        image: z.string().nullable(),
      })
      .nullable(),
    /** The ticket's creator: shows the Author badge. */
    isTargetAuthor: z.boolean(),
    createdAt: z.iso.datetime(),
    /** Set only when the author edited it. */
    editedAt: z.iso.datetime().nullable(),
    deleted: z.boolean(),
    /** The buttons show from these two, never from the web app's own role check. */
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    get replies(): z.ZodArray<typeof commentSchema> {
      return z.array(commentSchema);
    },
  })
  .meta({ id: 'Comment' });

export const commentTreeSchema = z.object({
  /** Live comments only. */
  count: z.number().int(),
  comments: z.array(commentSchema),
});
