import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { registerStream } from './notification.listener.js';
import { apiSuccess, apiError, parseBody, idParam } from '@/http.js';
import {
  notificationQuerySchema,
  historyQuerySchema,
  notificationReadSchema,
} from './notification.schema.js';
import {
  listNotificationGroups,
  listItemNotifications,
  setNotificationsRead,
} from './notification.service.js';

export const getNotifications = async (c: Context) => {
  const parsed = notificationQuerySchema.safeParse(c.req.query());
  if (!parsed.success)
    throw apiError(400, 'invalid_input', 'Invalid notification query');
  return apiSuccess(
    c,
    await listNotificationGroups(c.var.user.id, parsed.data),
  );
};
export const getItemNotifications = async (c: Context) => {
  const parsed = historyQuerySchema.safeParse(c.req.query());
  if (!parsed.success)
    throw apiError(400, 'invalid_input', 'Invalid history query');
  return apiSuccess(
    c,
    await listItemNotifications(
      c.var.user.id,
      idParam(c, 'itemId'),
      parsed.data,
    ),
  );
};
export const postReadNotifications = async (c: Context) => {
  const { ids } = await parseBody(c, notificationReadSchema);
  return apiSuccess(c, await setNotificationsRead(c.var.user.id, ids, true));
};
export const postUnreadNotifications = async (c: Context) => {
  const { ids } = await parseBody(c, notificationReadSchema);
  return apiSuccess(c, await setNotificationsRead(c.var.user.id, ids, false));
};

/** Bun's server, when the app runs under `Bun.serve` (index.ts passes it as the env). */
interface BunServerEnv {
  server?: { timeout: (request: Request, seconds: number) => void };
}

/** Holds the connection open and sends only `ready`, `changed` and a heartbeat; no data. */
export const getNotificationStream = (c: Context) => {
  // A quiet stream is not idle: switch off Bun's idle timeout for this request.
  (c.env as BunServerEnv | undefined)?.server?.timeout(c.req.raw, 0);
  c.header('Cache-Control', 'no-cache');
  c.header('X-Accel-Buffering', 'no');
  const userId = c.var.user.id;
  return streamSSE(c, async (stream) => {
    const unregister = registerStream(userId, () => {
      void stream
        .writeSSE({ event: 'changed', data: '' })
        .catch(() => undefined);
    });
    stream.onAbort(unregister);
    await stream.writeSSE({ event: 'ready', data: '' });
    while (!stream.aborted) {
      await stream.sleep(25_000);
      if (!stream.aborted) await stream.write(': ping\n\n');
    }
    unregister();
  });
};
