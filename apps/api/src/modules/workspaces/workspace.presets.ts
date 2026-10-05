import type { StateCategory, WorkspaceMode } from '@/generated/prisma/enums.js';

interface PresetState {
  name: string;
  key: string | null;
  category: StateCategory;
}

/** What a new workspace gets for its mode: rule switches and states, in board order. */
export const PRESETS: Record<
  WorkspaceMode,
  {
    switches: {
      checklistRequired: boolean;
      checklistMin: number | null;
      checklistMax: number | null;
      designRequired: boolean;
      approvalRequired: boolean;
      approverNotAuthor: boolean;
      plannedVsActual: boolean;
    };
    states: PresetState[];
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
    },
    states: [
      { name: 'To Do', key: null, category: 'UNSTARTED' },
      { name: 'In Progress', key: null, category: 'STARTED' },
      { name: 'Done', key: null, category: 'DONE' },
    ],
  },
};
