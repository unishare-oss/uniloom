import type {
  DocumentKind,
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
 * may set anyone; a member may only unclaim their own ticket, or claim a free one when the
 * project allows self-claim.
 */
export const mayAssign = (
  role: Role,
  userId: string,
  from: string | null,
  to: string | null,
  selfClaimAllowed: boolean,
) => {
  if (CREATORS.includes(role)) return true;
  const claim = selfClaimAllowed && from === null && to === userId;
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
 * Whether `role` may change a ticket assigned to `assigneeId` (its fields, checklist and
 * blocked-by links). Owners and managers may change any ticket; a member only their own.
 */
export const mayEdit = (
  role: Role,
  userId: string,
  assigneeId: string | null,
) => {
  return CREATORS.includes(role) || assigneeId === userId;
};

/**
 * Why `role` can't edit a ticket assigned to `assigneeId`, or null when they can. The
 * message says whether the member can claim it or must ask for it to be assigned.
 */
export const editError = (
  project: { selfClaimAllowed: boolean },
  role: Role,
  userId: string,
  assigneeId: string | null,
) => {
  if (mayEdit(role, userId, assigneeId)) return null;
  return project.selfClaimAllowed
    ? 'Members can only edit tickets assigned to them: claim it first'
    : 'Members can only edit tickets assigned to them: ask an owner or manager to assign it';
};

/**
 * Why a project can't have ticket documents, links, ADRs or tech debt, or null when it
 * can: they exist in Guided projects (coding work) only.
 */
export const guidedOnlyError = (project: { mode: ProjectMode }) => {
  return project.mode === 'GUIDED'
    ? null
    : 'Ticket documents are for Guided projects: this project is Standard';
};

/**
 * The kinds a Knowledge document can have in a project: ADRs and tech debt exist in
 * Guided projects only (the web reads this and never repeats the rule).
 */
export const documentKindsFor = (project: {
  mode: ProjectMode;
}): DocumentKind[] => {
  const common: DocumentKind[] = [
    'BRIEF',
    'PROPOSAL',
    'SPEC',
    'REFERENCE',
    'SLO',
    'SLA',
  ];
  return guidedOnlyError(project) ? common : [...common, 'ADR', 'TECH_DEBT'];
};

/**
 * The kinds the Knowledge page can create: tech debt is raised from a ticket instead
 * (the web reads this and never repeats the rule).
 */
export const creatableDocumentKindsFor = (project: {
  mode: ProjectMode;
}): DocumentKind[] => {
  return documentKindsFor(project).filter((kind) => kind !== 'TECH_DEBT');
};

/**
 * The kinds of document a ticket can start (spec, ADR, tech debt): none in a Standard
 * project, which has no ticket documents at all.
 */
export const ticketDocumentKindsFor = (project: {
  mode: ProjectMode;
}): DocumentKind[] => {
  return guidedOnlyError(project) ? [] : ['SPEC', 'ADR', 'TECH_DEBT'];
};

/**
 * Whether `role` may move a ticket whose assignee is `assigneeId`. Moving is editing plus
 * the In Review lock: after submission only owners and managers move it.
 */
export const mayMove = (
  role: Role,
  userId: string,
  assigneeId: string | null,
  sourceStateKey: string | null,
) => {
  return (
    CREATORS.includes(role) ||
    (sourceStateKey !== 'in_review' && mayEdit(role, userId, assigneeId))
  );
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

/**
 * Why `labels` can't share one item, or null when they can: names the first group that
 * two of them are in. Labels without a group combine freely.
 */
export const labelGroupError = (
  labels: { name: string; group: string | null }[],
) => {
  const seen = new Map<string, string>();
  for (const label of labels) {
    if (!label.group) continue;
    const first = seen.get(label.group);
    if (first)
      return `Only one "${label.group}" label per item: "${first}" and "${label.name}" are both in it`;
    seen.set(label.group, label.name);
  }
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
