import type { ProjectMode } from '@/generated/prisma/enums.js';
import type { PresetLabel, PresetState } from './project.types.js';

/** The `type` group every new project starts with: one of them per item. */
const TYPE_LABELS: PresetLabel[] = [
  { name: 'bug', color: 'RED', group: 'type' },
  { name: 'enhancement', color: 'BLUE', group: 'type' },
  { name: 'chore', color: 'GRAY', group: 'type' },
  { name: 'tech-debt', color: 'ORANGE', group: 'type' },
];

/** What a new project gets for its mode: rule switches, states in board order, and labels. */
export const PRESETS: Record<
  ProjectMode,
  {
    switches: {
      checklistRequired: boolean;
      checklistMin: number | null;
      checklistMax: number | null;
      designRequired: boolean;
      approvalRequired: boolean;
      approverNotAuthor: boolean;
      plannedVsActual: boolean;
      selfClaimAllowed: boolean;
    };
    states: PresetState[];
    labels: PresetLabel[];
  }
> = {
  GUIDED: {
    // 3 to 6 done-when items is the recommended default; owners can change it.
    switches: {
      checklistRequired: true,
      checklistMin: 3,
      checklistMax: 6,
      designRequired: true,
      approvalRequired: true,
      approverNotAuthor: true,
      plannedVsActual: true,
      selfClaimAllowed: true,
    },
    states: [
      { name: 'Triage', key: 'triage', category: 'BACKLOG' },
      { name: 'Backlog', key: 'backlog', category: 'BACKLOG' },
      { name: 'Aligning', key: 'aligning', category: 'UNSTARTED' },
      { name: 'Ready', key: 'ready', category: 'UNSTARTED' },
      { name: 'In Progress', key: 'in_progress', category: 'STARTED' },
      { name: 'Blocked', key: 'blocked', category: 'STARTED' },
      { name: 'In Review', key: 'in_review', category: 'STARTED' },
      { name: 'Done', key: 'done', category: 'DONE' },
      { name: 'Canceled', key: 'canceled', category: 'CANCELED' },
    ],
    labels: TYPE_LABELS,
  },
  STANDARD: {
    switches: {
      checklistRequired: false,
      checklistMin: null,
      checklistMax: null,
      designRequired: false,
      approvalRequired: false,
      approverNotAuthor: false,
      plannedVsActual: false,
      selfClaimAllowed: true,
    },
    states: [
      { name: 'To Do', key: null, category: 'UNSTARTED' },
      { name: 'In Progress', key: null, category: 'STARTED' },
      { name: 'Done', key: null, category: 'DONE' },
    ],
    labels: TYPE_LABELS,
  },
};
