import { prisma } from '@/db/prisma.js';
import { apiError } from '@/http.js';
import type { Prisma } from '@/generated/prisma/client.js';
import { toEntry } from './item.utils.js';
import * as checklistRepo from './checklist.repository.js';
import * as itemRepo from './item.repository.js';
import { loadItem } from './item.service.js';

/**
 * Sets the entries' positions to 0..n-1 in the order of `ids`. Positions are unique per
 * item and Postgres checks that row by row, so it first moves every entry to a negative
 * position, then to its place.
 */
const writePositions = async (tx: Prisma.TransactionClient, ids: string[]) => {
  for (const [i, id] of ids.entries())
    await checklistRepo.setEntryPosition(tx, id, -i - 1);
  for (const [i, id] of ids.entries())
    await checklistRepo.setEntryPosition(tx, id, i);
};

/** Adds an entry at the end of the item's checklist. */
export const addChecklistEntry = async (
  itemId: string,
  userId: string,
  input: { text: string },
) => {
  const { item } = await loadItem(itemId, userId);
  // Locked, so two adds at once can't take the same position or both pass the limit.
  const entry = await prisma.$transaction(async (tx) => {
    await itemRepo.lockItem(tx, itemId);
    const entries = await itemRepo.findChecklist(tx, itemId);
    const max = item.project.checklistMax;
    if (max !== null && entries.length >= max)
      throw apiError(
        409,
        'checklist_max_exceeded',
        `A checklist holds at most ${max} entries: split this slice`,
      );
    return checklistRepo.insertEntry(tx, itemId, input.text, entries.length);
  });
  return toEntry(entry);
};

/** Edits an entry's text, ticks or unticks it, sets its evidence. Unticking keeps it. */
export const updateChecklistEntry = async (
  itemId: string,
  entryId: string,
  userId: string,
  input: { text?: string; done?: boolean; evidence?: string | null },
) => {
  await loadItem(itemId, userId);
  // Locked, so a delete can't remove the entry between the check and the update.
  const entry = await prisma.$transaction(async (tx) => {
    await itemRepo.lockItem(tx, itemId);
    if (!(await checklistRepo.findEntry(tx, itemId, entryId)))
      throw apiError(404, 'not_found', 'Checklist entry not found');
    return checklistRepo.updateEntry(tx, entryId, {
      ...input,
      // Empty evidence clears it.
      evidence:
        input.evidence === undefined ? undefined : input.evidence || null,
    });
  });
  return toEntry(entry);
};

/** Deletes an entry and closes the gap, so positions stay 0..n-1. */
export const removeChecklistEntry = async (
  itemId: string,
  entryId: string,
  userId: string,
) => {
  await loadItem(itemId, userId);
  await prisma.$transaction(async (tx) => {
    await itemRepo.lockItem(tx, itemId);
    if (!(await checklistRepo.findEntry(tx, itemId, entryId)))
      throw apiError(404, 'not_found', 'Checklist entry not found');
    await checklistRepo.deleteEntry(tx, entryId);
    const rest = await itemRepo.findChecklist(tx, itemId);
    await writePositions(
      tx,
      rest.map((entry) => entry.id),
    );
  });
};

/** Sets the order. `ids` must be exactly the item's entries, once each. */
export const reorderChecklist = async (
  itemId: string,
  userId: string,
  ids: string[],
) => {
  await loadItem(itemId, userId);
  const entries = await prisma.$transaction(async (tx) => {
    await itemRepo.lockItem(tx, itemId);
    const current = await itemRepo.findChecklist(tx, itemId);
    if (
      ids.length !== current.length ||
      new Set(ids).size !== ids.length ||
      !current.every((entry) => ids.includes(entry.id))
    )
      throw apiError(
        400,
        'invalid_order',
        "ids must list every entry of the item's checklist, once each",
      );
    await writePositions(tx, ids);
    return itemRepo.findChecklist(tx, itemId);
  });
  return entries.map(toEntry);
};
