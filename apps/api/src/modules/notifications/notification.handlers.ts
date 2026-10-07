import type { Context } from 'hono';
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
