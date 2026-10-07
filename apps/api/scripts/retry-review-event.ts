import { z } from 'zod';
import { prisma } from '../src/db/prisma.js';
import { retryReviewEvent } from '../src/modules/notifications/notification.service.js';

try {
  const id = z.uuid().parse(process.argv[2]);
  await retryReviewEvent(id);
  console.log('Review event requeued', id);
} finally {
  await prisma.$disconnect();
}
