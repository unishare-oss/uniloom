import * as activityRepo from './activity.repository.js';
import { loadItem } from './item.service.js';
import { toActivity } from './item.utils.js';

/** The item's latest 50 changes, newest first. 404 like the item for a non-member. */
export const listItemActivity = async (id: string, userId: string) => {
  await loadItem(id, userId);
  return (await activityRepo.findActivity(id)).map(toActivity);
};
