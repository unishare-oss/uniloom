import type { findItem } from './item.repository.js';

export type ItemRow = NonNullable<Awaited<ReturnType<typeof findItem>>>;

export type EntryRow = ItemRow['checklist'][number];
