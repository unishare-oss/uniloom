import type { findDocument, findDocuments } from './document.repository.js';

/** A document row with its author, home ticket, origin and linking tickets. */
export type DocumentRow = NonNullable<Awaited<ReturnType<typeof findDocument>>>;

/** A list row: no body. */
export type SummaryRow = Awaited<ReturnType<typeof findDocuments>>[number];
