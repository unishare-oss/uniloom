import { Hono } from 'hono';
import { describe } from '@/openapi.js';
import {
  getNotifications,
  getItemNotifications,
  postReadNotifications,
  postUnreadNotifications,
} from './notification.handlers.js';
import {
  notificationQuerySchema,
  historyQuerySchema,
  notificationReadSchema,
  notificationReadResultSchema,
  notificationPageSchema,
  notificationHistorySchema,
} from './notification.schema.js';

export const notificationRoutes = new Hono();
notificationRoutes.get(
  '/notifications',
  describe({
    tag: 'Notifications',
    operationId: 'getNotifications',
    summary: 'Current user notification history grouped by task',
    query: notificationQuerySchema,
    data: notificationPageSchema,
  }),
  getNotifications,
);
notificationRoutes.get(
  '/notifications/items/:itemId',
  describe({
    tag: 'Notifications',
    operationId: 'getItemNotifications',
    summary: 'Current user submission history for a task',
    pathParams: ['itemId'],
    query: historyQuerySchema,
    data: notificationHistorySchema,
  }),
  getItemNotifications,
);
notificationRoutes.post(
  '/notifications/read',
  describe({
    tag: 'Notifications',
    operationId: 'postReadNotifications',
    summary: 'Mark explicitly displayed notification ids read',
    body: notificationReadSchema,
    data: notificationReadResultSchema,
  }),
  postReadNotifications,
);
notificationRoutes.post(
  '/notifications/unread',
  describe({
    tag: 'Notifications',
    operationId: 'postUnreadNotifications',
    summary: 'Mark explicitly selected notification ids unread',
    body: notificationReadSchema,
    data: notificationReadResultSchema,
  }),
  postUnreadNotifications,
);
