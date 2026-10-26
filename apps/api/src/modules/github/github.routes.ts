import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  deleteRepository,
  getItemPullRequests,
  getRepositories,
  putRepository,
  receiveWebhook,
} from './github.handlers.js';
import {
  githubRepositorySchema,
  githubSettingsSchema,
  pullRequestSchema,
} from './github.schema.js';

/** Public, mounted at `/github`: GitHub's webhook calls, signed with the shared secret. */
export const githubWebhookRoutes = new Hono();

githubWebhookRoutes.post(
  '/webhook',
  bodyLimit({ maxSize: 25 * 1024 * 1024 }),
  receiveWebhook,
);

/** Signed in and consented, mounted at `/`. */
export const githubRoutes = new Hono();

githubRoutes.get(
  '/items/:id/pull-requests',
  describe({
    tag: 'github',
    operationId: 'listItemPullRequests',
    summary: 'The GitHub pull requests that name this ticket (any member)',
    pathParams: ['id'],
    data: z.array(pullRequestSchema),
  }),
  getItemPullRequests,
);
githubRoutes.get(
  '/projects/:projectId/github/repositories',
  describe({
    tag: 'github',
    operationId: 'listGithubRepositories',
    summary: 'The repos the GitHub App can see, and which are mapped (Owner)',
    pathParams: ['projectId'],
    data: githubSettingsSchema,
  }),
  getRepositories,
);
githubRoutes.put(
  '/projects/:projectId/github/repositories/:repositoryId',
  describe({
    tag: 'github',
    operationId: 'mapGithubRepository',
    summary: 'Link pull requests of this repo to the project (Owner)',
    pathParams: ['projectId', 'repositoryId'],
    data: githubRepositorySchema,
  }),
  putRepository,
);
githubRoutes.delete(
  '/projects/:projectId/github/repositories/:repositoryId',
  describe({
    tag: 'github',
    operationId: 'unmapGithubRepository',
    summary: 'Stop linking pull requests of this repo; links made stay (Owner)',
    pathParams: ['projectId', 'repositoryId'],
    data: z.null(),
  }),
  deleteRepository,
);
