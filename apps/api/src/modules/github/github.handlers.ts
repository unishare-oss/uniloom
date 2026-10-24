import type { Context } from 'hono';
import { apiError, apiSuccess, idParam, numberIdParam } from '@/http.js';
import type { Prisma } from '@/generated/prisma/client.js';
import {
  listItemPullRequests,
  listProjectRepositories,
  mapRepository,
  receiveDelivery,
  unmapRepository,
} from './github.service.js';
import { verifySignature } from './github.utils.js';

/** GitHub calls this: the signature is the authentication. Never log the body or the secret. */
export const receiveWebhook = async (c: Context) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret)
    throw apiError(503, 'not_configured', 'GitHub webhooks are not set up');
  // The signature covers the raw text, so read it before any JSON parsing.
  const body = await c.req.text();
  if (!verifySignature(body, c.req.header('x-hub-signature-256'), secret))
    throw apiError(401, 'invalid_signature', 'Invalid signature');
  const id = c.req.header('x-github-delivery');
  const event = c.req.header('x-github-event');
  if (!id || !event)
    throw apiError(400, 'invalid_input', 'Missing GitHub headers');
  let payload: Prisma.InputJsonValue;
  try {
    payload = JSON.parse(body);
  } catch {
    throw apiError(400, 'invalid_input', 'Body is not JSON');
  }
  await receiveDelivery(id, event, payload);
  return apiSuccess(c, null, 'Accepted', 202);
};

export const getItemPullRequests = async (c: Context) =>
  apiSuccess(c, await listItemPullRequests(idParam(c, 'id'), c.var.user.id));

export const getRepositories = async (c: Context) =>
  apiSuccess(
    c,
    await listProjectRepositories(idParam(c, 'projectId'), c.var.user.id),
  );

export const putRepository = async (c: Context) =>
  apiSuccess(
    c,
    await mapRepository(
      idParam(c, 'projectId'),
      c.var.user.id,
      numberIdParam(c, 'repositoryId'),
    ),
    'Repository mapped',
  );

export const deleteRepository = async (c: Context) => {
  await unmapRepository(
    idParam(c, 'projectId'),
    c.var.user.id,
    numberIdParam(c, 'repositoryId'),
  );
  return apiSuccess(c, null, 'Repository unmapped');
};
