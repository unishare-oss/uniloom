import { prisma } from '@/db/prisma.js';
import { apiError } from '@/http.js';
import * as itemRules from './item.rules.js';
import * as blockerRepo from './blocker.repository.js';
import * as itemRepo from './item.repository.js';
import { getItem, loadItem } from './item.service.js';

/** Records that the item waits on `blockerId`. */
export const addBlocker = async (
  id: string,
  userId: string,
  blockerId: string,
) => {
  const { item, role } = await loadItem(id, userId);
  const editMessage = itemRules.editError(
    item.project,
    role,
    userId,
    item.assigneeId,
  );
  if (editMessage) throw apiError(403, 'forbidden', editMessage);
  if (blockerId === id)
    throw apiError(400, 'self_block', "An item can't wait on itself");
  const blocker = await itemRepo.findItem(blockerId);
  if (!blocker || blocker.projectId !== item.projectId)
    throw apiError(
      400,
      'invalid_blocker',
      'The blocker must be an item in this project',
    );
  // Locked, so two adds at once can't both pass (A→B and B→A together are a loop).
  await prisma.$transaction(async (tx) => {
    await blockerRepo.lockProject(tx, item.projectId);
    const links = await blockerRepo.findLinks(tx, item.projectId);
    if (
      links.some(
        (link) => link.blockedId === id && link.blockerId === blockerId,
      )
    )
      throw apiError(409, 'already_blocked', 'It already waits on that item');
    if (itemRules.wouldCreateCycle(links, id, blockerId))
      throw apiError(
        409,
        'blocking_cycle',
        'That would make the items wait on each other',
      );
    await blockerRepo.insertLink(tx, id, blockerId);
  });
  return getItem(id, userId);
};

export const removeBlocker = async (
  id: string,
  userId: string,
  blockerId: string,
) => {
  const { item, role } = await loadItem(id, userId);
  const editMessage = itemRules.editError(
    item.project,
    role,
    userId,
    item.assigneeId,
  );
  if (editMessage) throw apiError(403, 'forbidden', editMessage);
  await blockerRepo.deleteLink(id, blockerId);
};
