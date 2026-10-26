import type { z } from 'zod';
import type { findItem } from './item.repository.js';
import type { activitySchema } from './item.schema.js';

export type ItemRow = NonNullable<Awaited<ReturnType<typeof findItem>>>;

export type EntryRow = ItemRow['checklist'][number];

/** An activity row as the API returns it. */
export type Activity = z.infer<typeof activitySchema>;

/** One field an update changed. */
export type ActivityChange = Extract<
  Activity,
  { action: 'item.update' }
>['detail']['changes'][number];

/** What a write records: the action and its detail, the part each service decides. */
export type ActivityDetail = Activity extends infer Row
  ? Row extends Activity
    ? Pick<Row, 'action' | 'detail'>
    : never
  : never;

/** The agent behind a change, from the token; absent for a change on the website. */
export interface ItemAgent {
  clientId: string | null;
  clientName: string | null;
}

/** The pull requests behind a move or a skipped move that GitHub made. */
export interface GithubPullRequestLine {
  number: number;
  url: string;
  base: string;
  mergedBy: string | null;
}
