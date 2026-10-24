import { prisma } from '../src/db/prisma.js';
import { retryFailedGithubDeliveries } from '../src/modules/github/delivery.service.js';

try {
  const count = await retryFailedGithubDeliveries();
  console.log('GitHub deliveries requeued', count);
} finally {
  await prisma.$disconnect();
}
