import { setTimeout as delay } from 'node:timers/promises';
import { prisma } from '@/db/prisma.js';
import { processNextReviewEvent } from '@/modules/notifications/notification.service.js';

const shutdown = new AbortController();
process.on('SIGINT', () => shutdown.abort());
process.on('SIGTERM', () => shutdown.abort());

try {
  while (!shutdown.signal.aborted) {
    let wait = 2_000;
    try {
      for (let count = 0; count < 25 && !shutdown.signal.aborted; count++)
        if (!(await processNextReviewEvent())) break;
    } catch {
      console.error(
        'Notification worker could not process events; retrying after backoff',
      );
      wait = 5_000;
    }
    await delay(wait, undefined, { signal: shutdown.signal }).catch(
      () => undefined,
    );
  }
} finally {
  await prisma.$disconnect();
}
