import { z } from 'zod';

export const pullRequestSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  url: z.string(),
  repository: z.string(),
  state: z.enum(['OPEN', 'CLOSED', 'MERGED']),
  headRef: z.string(),
  baseRef: z.string(),
  authorLogin: z.string(),
  mergedByLogin: z.string().nullable(),
  checks: z.enum(['none', 'pending', 'failure', 'success']),
  /** True when the pull request says it closes this ticket. */
  closes: z.boolean(),
});

export const githubRepositorySchema = z.object({
  /** GitHub's repository id, as a string (it can be larger than JSON numbers keep exactly). */
  id: z.string(),
  fullName: z.string(),
  mapped: z.boolean(),
});

export const githubSettingsSchema = z.object({
  /** Where the Owner installs the App for this project; null when GITHUB_APP_SLUG is not set. */
  installUrl: z.string().nullable(),
  /** True when the App has a live installation, even one with no repos selected. */
  installed: z.boolean(),
  repositories: z.array(githubRepositorySchema),
});
