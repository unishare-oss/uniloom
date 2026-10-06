import type {
  ItemKind,
  ProjectMode,
  Role,
  StateCategory,
} from '@/generated/prisma/enums.js';
import { CREATORS } from '@/modules/members/member.service.js';

/** For each kind a mode allows: the kinds its parent may have (null = no parent). */
const ALLOWED_PARENTS: Record<
  ProjectMode,
  Partial<Record<ItemKind, (ItemKind | null)[]>>
> = {
  // Two levels: a slice belongs to a feature.
  GUIDED: { FEATURE: [null], SLICE: ['FEATURE'] },
  // Two levels: a subtask belongs to a task.
  STANDARD: { TASK: [null], SUBTASK: ['TASK'] },
};

/** Why `kind` under `parentKind` isn't allowed in `mode`, or null when it is. */
export const kindError = (
  mode: ProjectMode,
  kind: ItemKind,
  parentKind: ItemKind | null,
) => {
  const parents = ALLOWED_PARENTS[mode][kind];
  if (!parents) return `${mode} projects have no ${kind} items`;
  if (!parents.includes(parentKind))
    return parentKind
      ? `a ${kind} can't be under a ${parentKind}`
      : `a ${kind} needs a parent (${parents.filter(Boolean).join(' or ')})`;
  return null;
};

/**
 * Whether `role` may change a ticket's assignee from `from` to `to`. Owners and managers
 * may set anyone; a member may only claim a free ticket or unclaim their own.
 */
export const mayAssign = (
  role: Role,
  userId: string,
  from: string | null,
  to: string | null,
) => {
  if (CREATORS.includes(role)) return true;
  const claim = from === null && to === userId;
  const unclaim = from === userId && to === null;
  return claim || unclaim;
};

/**
 * Whether adding "blocked waits on blocker" closes a loop: following the existing
 * "waits on" links from `blocker` reaches `blocked`.
 */
export const wouldCreateCycle = (
  links: { blockedId: string; blockerId: string }[],
  blockedId: string,
  blockerId: string,
) => {
  const seen = new Set<string>();
  const queue = [blockerId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (current === blockedId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const link of links)
      if (link.blockedId === current) queue.push(link.blockerId);
  }
  return false;
};

/**
 * Whether `role` may move a ticket whose assignee is `assigneeId`. Owners and managers move
 * any ticket; a member only moves one assigned to them.
 */
export const mayMove = (
  role: Role,
  userId: string,
  assigneeId: string | null,
) => {
  return CREATORS.includes(role) || assigneeId === userId;
};

/** Whether `role` may move a ticket into a Done state. */
export const mayMoveToDone = (role: Role) => {
  return CREATORS.includes(role);
};

/**
 * Why an item can't move to `target`, or null when it can. Only In Review and Done states
 * are gated. Any item with entries needs them all ticked; slices and subtasks also need
 * `checklistMin` entries when the project requires checklists.
 */
export const checklistError = (
  project: { checklistRequired: boolean; checklistMin: number | null },
  kind: ItemKind,
  entries: { text: string; done: boolean }[],
  target: { key: string | null; category: StateCategory },
) => {
  if (target.key !== 'in_review' && target.category !== 'DONE') return null;
  const required =
    project.checklistRequired && (kind === 'SLICE' || kind === 'SUBTASK');
  const min = required ? (project.checklistMin ?? 0) : 0;
  if (entries.length < min)
    return `It needs at least ${min} checklist entries, it has ${entries.length}`;
  const open = entries.filter((entry) => !entry.done);
  if (open.length > 0)
    return `Tick every checklist entry first: ${open.map((entry) => `"${entry.text}"`).join(', ')}`;
  return null;
};

/** Whether a feature is finished: it has slices and each is Done or Canceled. */
export const featureDone = (
  children: { state: { category: StateCategory } }[],
) => {
  return (
    children.length > 0 &&
    children.every(
      (child) =>
        child.state.category === 'DONE' || child.state.category === 'CANCELED',
    )
  );
};
