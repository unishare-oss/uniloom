// Fills the dev database with test projects that show every rule built so far, so each
// case can be tried in the browser. Run `bun run db:seed` after signing in once.
//
// SEED_OWNER_EMAIL picks your account (default: the first user who signed in). It may list
// several, comma-separated: the first is "you" in the items, and the others get the same
// role in every seed project. Reruns replace the seed projects (every key in SEED_PROJECTS)
// and never touch any other project.
//
// A plan that adds a rule adds its cases here: a function per project, item titles that
// say what to try and what should happen.
import { prisma } from '../src/db/prisma.js';
import type {
  ItemKind,
  Priority,
  Role,
} from '../src/generated/prisma/enums.js';
import {
  createProjectItem,
  removeItem,
  moveItem,
  updateProjectItem,
} from '../src/modules/items/item.service.js';
import { addBlocker } from '../src/modules/items/blocker.service.js';
import {
  addChecklistEntry,
  updateChecklistEntry,
} from '../src/modules/items/checklist.service.js';
import {
  createDocument,
  setDocumentStatus,
  updateDocumentById,
} from '../src/modules/documents/document.service.js';
import {
  createTicketDocument,
  linkDocument,
} from '../src/modules/items/item-document.service.js';
import {
  createDocumentComment,
  createItemComment,
  deleteComment,
  updateComment,
} from '../src/modules/comments/comment.service.js';
import {
  createInvite,
  joinByInvite,
} from '../src/modules/invites/invite.service.js';
import {
  decideJoinRequest,
  listJoinRequests,
} from '../src/modules/invites/request.service.js';
import {
  createProject,
  updateProject,
} from '../src/modules/projects/project.service.js';

const SEED_PROJECTS = {
  TG: 'Seed · Guided',
  TS: 'Seed · Standard',
  TR: 'Seed · Manager',
  TM: 'Seed · Member',
  TC: 'Seed · No self-claim',
  TL: 'Seed · Lowered limits',
  TX: 'Seed · Not a member',
  TI: 'Seed · Review inbox',
  TV: 'Seed · Invite link',
  TO: 'Seed · Open invite',
  TF: 'Seed · Full invite',
  TE: 'Seed · Expired invite',
  TA: 'Seed · Join requests',
  TQ: 'Seed · Ask to join',
  TW: 'Seed · Waiting',
  TD: 'Seed · Declined',
  TZ: 'Seed · Delete me',
  TU: 'Seed · Delete as manager',
  TK: 'Seed · Already deleted',
};

/** Fake people, so there are assignees, authors and an owner who isn't you. */
const SEED_USERS = [
  { id: 'seed-mya', name: 'Mya (seed)', email: 'seed-mya@example.com' },
  { id: 'seed-ko', name: 'Ko (seed)', email: 'seed-ko@example.com' },
];

/** The accounts in SEED_OWNER_EMAIL, in order, or the first user who signed in. */
const findOwners = async () => {
  const emails = (process.env.SEED_OWNER_EMAIL ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
  if (emails.length === 0) {
    const first = await prisma.user.findFirst({
      where: { id: { notIn: SEED_USERS.map((u) => u.id) } },
      orderBy: { createdAt: 'asc' },
    });
    if (!first)
      throw new Error(
        'No user to own the seed projects: sign in to Uniloom once first',
      );
    return [first];
  }
  const users = [];
  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      throw new Error(
        `No user with email ${email}: they must sign in to Uniloom once first`,
      );
    users.push(user);
  }
  return users;
};

/** The other owners get your role in every seed project you are in. */
const addOtherOwners = async (ownerId: string, otherIds: string[]) => {
  const yours = await prisma.member.findMany({
    where: {
      userId: ownerId,
      project: { keyPrefix: { in: Object.keys(SEED_PROJECTS) } },
    },
  });
  await prisma.member.createMany({
    data: otherIds.flatMap((userId) =>
      yours.map((member) => ({
        projectId: member.projectId,
        userId,
        role: member.role,
      })),
    ),
  });
};

/** Deletes earlier seed projects; refuses if a seed key belongs to a real project. */
const removeOldSeed = async () => {
  const existing = await prisma.project.findMany({
    where: { keyPrefix: { in: Object.keys(SEED_PROJECTS) } },
  });
  for (const project of existing) {
    const seedName =
      SEED_PROJECTS[project.keyPrefix as keyof typeof SEED_PROJECTS];
    if (project.name !== seedName)
      throw new Error(
        `${project.keyPrefix} is used by "${project.name}", not the seed: rename the seed keys`,
      );
  }
  const ids = existing.map((project) => project.id);
  // Items point at their parent and state with NoAction, so clear them before the cascade.
  await prisma.$transaction([
    prisma.item.updateMany({
      where: { projectId: { in: ids } },
      data: { parentId: null },
    }),
    prisma.item.deleteMany({ where: { projectId: { in: ids } } }),
    prisma.project.deleteMany({ where: { id: { in: ids } } }),
  ]);
};

const seedProject = async (
  keyPrefix: keyof typeof SEED_PROJECTS,
  mode: 'GUIDED' | 'STANDARD',
  ownerId: string,
  members: { userId: string; role: Role }[],
) => {
  const project = await createProject(ownerId, {
    name: SEED_PROJECTS[keyPrefix],
    keyPrefix,
    mode,
  });
  await prisma.member.createMany({
    data: members.map((member) => ({ ...member, projectId: project.id })),
  });
  const states = await prisma.state.findMany({
    where: { projectId: project.id },
    orderBy: { position: 'asc' },
  });
  /** Creates an item through the real rules; `state` is the column name. */
  const item = ({
    state,
    by,
    ...input
  }: {
    kind: ItemKind;
    title: string;
    state?: string;
    parentId?: string;
    priority?: Priority;
    assigneeId?: string;
    description?: string;
    by?: string;
  }) =>
    createProjectItem(project.id, by ?? ownerId, {
      ...input,
      stateId: state
        ? states.find((column) => column.name === state)!.id
        : undefined,
    });
  return { project, item };
};

const DESCRIPTION = `Markdown with a list, \`code\`, a [link](https://example.com) and a diagram.

- one
- two

\`\`\`mermaid
flowchart LR
  Aligning --> Ready --> InProgress[In Progress] --> InReview[In Review] --> Done
\`\`\`
`;

/** Adds entries to an item, ticking the first `ticked` of them. */
const addEntries = async (
  itemId: string,
  userId: string,
  texts: string[],
  ticked: number,
) => {
  for (const [i, text] of texts.entries()) {
    const entry = await addChecklistEntry(itemId, userId, { text });
    if (i < ticked)
      await updateChecklistEntry(itemId, entry.id, userId, { done: true });
  }
};

const checks: string[] = [];
const note = (key: string, what: string) => checks.push(`${key}  ${what}`);

/** Guided, you own it: every column, kinds, parents, blocked-by and the trash. */
const seedGuided = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const { project, item } = await seedProject('TG', 'GUIDED', ownerId, [
    { userId: mya.id, role: 'MANAGER' },
    { userId: ko.id, role: 'MEMBER' },
  ]);

  // Every column has at least one card.
  const board = await item({
    kind: 'FEATURE',
    title: 'Board: a slice in every column',
    description: DESCRIPTION,
    priority: 'HIGH',
  });
  const columns = [
    'Triage',
    'Backlog',
    'Aligning',
    'Ready',
    'In Progress',
    'Blocked',
    'In Review',
    'Done',
    'Canceled',
  ];
  const priorities: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
  const assignees = [ownerId, mya.id, ko.id, undefined];
  for (const [i, state] of columns.entries())
    await item({
      kind: 'SLICE',
      title: `${state} slice (${priorities[i % 5].toLowerCase()} priority)`,
      state,
      parentId: board.id,
      priority: priorities[i % 5],
      assigneeId: assignees[i % 4],
      by: i % 2 ? mya.id : ownerId,
    });
  note(
    board.key,
    'drag its slices between columns; Mermaid renders in the description',
  );

  // Activity: changes by you, by Mya and by Mya's agent, in order.
  const agent = { clientId: 'seed-client', clientName: 'Claude Code' };
  const history = await item({
    kind: 'FEATURE',
    title:
      'Activity: open me to see who changed what, and which changes an agent made',
  });
  const states = await prisma.state.findMany({
    where: { projectId: project.id },
  });
  const progress = states.find((state) => state.name === 'In Progress')!;
  const review = states.find((state) => state.name === 'In Review')!;
  const entry = await addChecklistEntry(history.id, ownerId, {
    text: 'It works',
  });
  await updateProjectItem(history.id, ownerId, {
    priority: 'HIGH',
    description: 'A first description.',
    assigneeId: mya.id,
  });
  await moveItem(history.id, ownerId, progress.id);
  await updateChecklistEntry(history.id, entry.id, mya.id, {
    done: true,
    evidence: 'commit 1a2b3c4',
  });
  await updateChecklistEntry(
    history.id,
    entry.id,
    mya.id,
    { done: false },
    agent,
  );
  await updateChecklistEntry(
    history.id,
    entry.id,
    mya.id,
    { done: true, evidence: 'bun run test: 12 passed' },
    agent,
  );
  await moveItem(history.id, ownerId, review.id);
  note(
    history.key,
    "Activity: rows by you, Mya and Mya's agent (Claude Code chip, robot badge); the tick shows its evidence",
  );

  // MCP write tools: things to try from an agent connected as you.
  const toDone = await item({
    kind: 'SLICE',
    title:
      'Agent: save_item with state Done → people_only (agents never move to Ready or Done)',
    parentId: board.id,
    state: 'In Review',
  });
  await addEntries(
    toDone.id,
    ownerId,
    ['Ticked already', 'Also ticked', 'Third'],
    3,
  );
  const toReview = await item({
    kind: 'SLICE',
    title:
      'Agent: check_criterion for each entry, then save_item with state In Review → works',
    parentId: board.id,
    state: 'In Progress',
  });
  await addEntries(
    toReview.id,
    ownerId,
    ['First entry', 'Second entry', 'Third entry'],
    0,
  );
  const tooMany = await item({
    kind: 'SLICE',
    title:
      'Agent: set_criteria with 7 texts → checklist_max_exceeded and the list stays; with 4 → works',
    parentId: board.id,
    state: 'In Progress',
  });
  await addEntries(tooMany.id, ownerId, ['Old one', 'Old two', 'Old three'], 0);
  note(toDone.key, 'agent: move to Done → people_only');
  note(toReview.key, 'agent: tick all three, move to In Review → works');
  note(tooMany.key, 'agent: set_criteria with 7 → checklist_max_exceeded');

  // Parents.
  const parent = await item({
    kind: 'FEATURE',
    title: 'Delete me → 409 has_children (it has a slice)',
  });
  const child = await item({
    kind: 'SLICE',
    title:
      'Set my parent to a slice → 400 invalid_kind; clear it → 400 (a slice needs a feature)',
    parentId: parent.id,
  });
  note(parent.key, 'delete → refused, it has children');
  note(child.key, 'parent picker: another slice or none → refused');
  const loneFeature = await item({
    kind: 'FEATURE',
    title:
      'Set my parent to any item → 400 invalid_kind (features have no parent)',
  });
  note(loneFeature.key, 'parent picker → refused');

  // Blocked-by: C waits on B, B waits on A.
  const a = await item({ kind: 'FEATURE', title: 'Chain A' });
  const b = await item({ kind: 'FEATURE', title: 'Chain B (waits on A)' });
  const c = await item({
    kind: 'FEATURE',
    title: 'Chain C (waits on B). Make A wait on C → 409 blocking_cycle',
  });
  await addBlocker(b.id, ownerId, a.id);
  await addBlocker(c.id, ownerId, b.id);
  note(a.key, 'add blocker C → refused, loop; add blocker A → refused, itself');
  note(c.key, 'add blocker B again → 409 already_blocked');

  // Trash: a slice to restore, and one whose feature is deleted too.
  const kept = await item({
    kind: 'FEATURE',
    title: 'Trash: parent still here',
  });
  const restorable = await item({
    kind: 'SLICE',
    title: 'Restore me → back under my feature',
    parentId: kept.id,
  });
  const gone = await item({ kind: 'FEATURE', title: 'Trash: deleted feature' });
  const orphan = await item({
    kind: 'SLICE',
    title: 'Restore me first → 409 parent_deleted; restore my feature, then me',
    parentId: gone.id,
  });
  await removeItem(restorable.id, ownerId);
  await removeItem(orphan.id, ownerId);
  await removeItem(gone.id, ownerId);
  note(
    'TG trash',
    `restore ${restorable.key} → works; ${orphan.key} → refused until ${gone.key} is back`,
  );

  await item({
    kind: 'SLICE',
    title:
      'A very long title that keeps going to check how cards, the item page header and the breadcrumb wrap when someone writes far more than they should',
    parentId: board.id,
    state: 'Backlog',
  });

  // Checklist: half ticked, one entry with evidence.
  const checklist = await item({
    kind: 'SLICE',
    title: 'Checklist: tick the rest, add evidence, reorder',
    parentId: board.id,
    state: 'In Progress',
  });
  const texts = [
    'The endpoint answers 404 to a non-member',
    'Tests cover the empty-text case',
    'The item page shows the new section',
    'The seed has a slice to try it on',
  ];
  const entries = [];
  for (const text of texts)
    entries.push(await addChecklistEntry(checklist.id, ownerId, { text }));
  await updateChecklistEntry(checklist.id, entries[0].id, ownerId, {
    done: true,
    evidence: 'a1b2c3d',
  });
  await updateChecklistEntry(checklist.id, entries[1].id, ownerId, {
    done: true,
  });
  note(
    checklist.key,
    'tick an entry → asks for evidence (Enter saves, Skip leaves it empty); edit, move and delete entries; add one with empty text → refused',
  );

  // Moves: finishing the last slice finishes its feature.
  const finishing = await item({
    kind: 'FEATURE',
    title: 'Finish my last slice → I go to Done by myself',
  });
  await item({
    kind: 'SLICE',
    title: 'Done slice (already finished)',
    parentId: finishing.id,
    state: 'Done',
  });
  const last = await item({
    kind: 'SLICE',
    title:
      'Last open slice: move me to Done → works (checklist is ticked) and my feature goes Done',
    parentId: finishing.id,
    state: 'In Review',
  });
  await addEntries(
    last.id,
    ownerId,
    ['Entry one', 'Entry two', 'Entry three'],
    3,
  );
  note(
    last.key,
    `move to Done → works, and ${finishing.key} moves to Done by itself`,
  );

  // Labels: the project starts with the `type` group; add one free label and one to delete.
  await prisma.label.createMany({
    data: [
      { projectId: project.id, name: 'frontend', color: 'GREEN' },
      { projectId: project.id, name: 'delete-me', color: 'PINK' },
    ],
  });
  const labels = await prisma.label.findMany({
    where: { projectId: project.id },
  });
  const labelId = (name: string) => labels.find((l) => l.name === name)!.id;
  const bugged = await item({
    kind: 'FEATURE',
    title:
      'Has bug. Add chore → 409 label_group_conflict (one type); add frontend → works, it combines',
  });
  await updateProjectItem(bugged.id, ownerId, { labelIds: [labelId('bug')] });
  const doomed = await item({
    kind: 'FEATURE',
    title:
      'Has delete-me and enhancement. Delete the delete-me label in Settings → it leaves this item',
  });
  await updateProjectItem(doomed.id, ownerId, {
    labelIds: [labelId('enhancement'), labelId('delete-me')],
  });
  note(
    bugged.key,
    'label picker: chore is greyed out while bug is on; frontend → works; a direct chore → 409',
  );
  note(
    doomed.key,
    'Settings → Labels → delete delete-me → confirm; the chip is gone here',
  );
  note(
    'TG labels',
    'Settings → Labels: rename, recolour, regroup (owner); a name that exists → 409 label_name_taken',
  );
};

/** Standard, you own it: task → subtask. */
const seedStandard = async (ownerId: string) => {
  const [mya] = SEED_USERS;
  const { item } = await seedProject('TS', 'STANDARD', ownerId, [
    { userId: mya.id, role: 'MEMBER' },
  ]);
  const task = await item({
    kind: 'TASK',
    title: 'Delete me → 409 has_children',
    state: 'In Progress',
    assigneeId: mya.id,
  });
  const sub = await item({
    kind: 'SUBTASK',
    title: 'Subtask. Clear my parent → 400 (a subtask needs a task)',
    parentId: task.id,
  });
  const other = await item({
    kind: 'SUBTASK',
    title: 'Subtask. Set my parent to the other subtask → 400 invalid_kind',
    parentId: task.id,
  });
  await item({
    kind: 'TASK',
    title: 'Standalone task',
    state: 'Done',
  });
  note(task.key, 'delete → refused, it has subtasks');
  note(sub.key, 'parent picker: none → refused; the other subtask → refused');
  note(other.key, 'parent picker: the task → works');
};

/** Guided, someone else owns it and you are a manager: create, delete, add members as Member. */
const seedManager = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const { item } = await seedProject('TR', 'GUIDED', mya.id, [
    { userId: ownerId, role: 'MANAGER' },
    { userId: ko.id, role: 'MEMBER' },
  ]);
  const feature = await item({
    kind: 'FEATURE',
    title: 'Feature. Delete me → works, you are a manager (restore from Trash)',
  });
  await item({
    kind: 'SLICE',
    title:
      'Slice in Aligning. Move it to Ready → works (managers move any ticket)',
    parentId: feature.id,
    state: 'Aligning',
  });
  note('TR', 'you are a MANAGER here: New item and Delete work');
  note(
    'TR members',
    'add someone by email as Member → works; as Owner or Manager → refused (403); no role picker, no Remove',
  );
};

/** Guided, someone else owns it and you are a member: no create, delete or restore. */
const seedMember = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const { project, item } = await seedProject('TM', 'GUIDED', mya.id, [
    { userId: ownerId, role: 'MEMBER' },
    { userId: ko.id, role: 'MANAGER' },
  ]);
  const feature = await item({
    kind: 'FEATURE',
    title: 'Feature. Open it → no Add subtask, no Delete (you are a member)',
  });
  const slice = await item({
    kind: 'SLICE',
    title:
      'Slice nobody has. Its card does not drag and State is disabled: Claim it, then move it → works',
    parentId: feature.id,
    state: 'Backlog',
  });
  const free = await item({
    kind: 'SLICE',
    title: 'Slice nobody has. Click Claim → it is yours',
    parentId: feature.id,
  });
  const yours = await item({
    kind: 'SLICE',
    title: 'Slice assigned to you. Click Unclaim → it is free again',
    parentId: feature.id,
    assigneeId: ownerId,
  });
  const taken = await item({
    kind: 'SLICE',
    title:
      'Slice assigned to Mya. Open it → no Claim, State is disabled, the card does not drag; a direct move → 403',
    parentId: feature.id,
    assigneeId: mya.id,
  });
  const freeEdit = await item({
    kind: 'SLICE',
    title:
      'Slice nobody has. Title, priority, labels, checklist and parent are disabled ("Claim it to edit"); a direct edit → 403; claim it, then edit → works',
    parentId: feature.id,
  });
  const taken2 = await item({
    kind: 'SLICE',
    title:
      'Slice assigned to Mya. Edit controls are disabled ("Only its assignee, owners and managers can edit it"); a direct edit or checklist tick → 403',
    parentId: feature.id,
    assigneeId: mya.id,
  });
  const mine = await item({
    kind: 'SLICE',
    title:
      'Slice assigned to you. Move it to Done → 403 (no Done in State); to In Progress → works',
    parentId: feature.id,
    state: 'Ready',
    assigneeId: ownerId,
  });
  const unticked = await item({
    kind: 'SLICE',
    title:
      'Slice assigned to you with an unticked entry. Move it to In Review → 409, naming the entry; tick it, then move → works',
    parentId: feature.id,
    state: 'In Progress',
    assigneeId: ownerId,
  });
  await addEntries(
    unticked.id,
    mya.id,
    ['Entry one', 'Entry two', 'Write the tests'],
    2,
  );
  const full = await item({
    kind: 'SLICE',
    title:
      'Slice assigned to you with 6 entries. Add a 7th → 409 checklist_max_exceeded: split this slice',
    parentId: feature.id,
    state: 'In Progress',
    assigneeId: ownerId,
  });
  await addEntries(full.id, mya.id, ['1', '2', '3', '4', '5', '6'], 0);
  const states = await prisma.state.findMany({
    where: { projectId: project.id },
  });
  const review = states.find((state) => state.key === 'in_review')!.id;
  const progress = states.find((state) => state.key === 'in_progress')!.id;
  const locked = await item({
    kind: 'SLICE',
    parentId: feature.id,
    assigneeId: ownerId,
    title:
      'You submitted this: State is disabled; a direct move returns 403 review_locked',
    state: 'In Progress',
  });
  await addEntries(
    locked.id,
    mya.id,
    [
      'Submit to review',
      'Assignee move is refused',
      'Owner or Manager must return it',
    ],
    3,
  );
  await moveItem(locked.id, ownerId, review);
  const returned = await item({
    kind: 'SLICE',
    parentId: feature.id,
    assigneeId: ownerId,
    title: 'Manager returned this: move to In Review again to resubmit',
    state: 'In Progress',
  });
  await addEntries(
    returned.id,
    mya.id,
    [
      'First submission retained',
      'Manager returns the task',
      'Assignee can resubmit',
    ],
    3,
  );
  await moveItem(returned.id, ownerId, review);
  await moveItem(returned.id, ko.id, progress);
  note(
    locked.key,
    'State disabled despite your assignment; project is hidden from your reviewer inbox',
  );
  note(
    returned.key,
    'State enabled after Manager return; resubmission records another event',
  );
  note(
    'TM',
    'you are a MEMBER here: no New item, Add subtask, Delete or Restore',
  );
  note(
    slice.key,
    'card does not drag, State disabled; Claim it → then State works; edit the title, set a blocker → works',
  );
  note(
    freeEdit.key,
    'edit → 403 forbidden "claim it first"; Claim it → every edit control works; Unclaim → disabled again',
  );
  note(
    taken2.key,
    'edit, checklist tick and blocker changes → 403 forbidden; reading stays open',
  );
  note(mine.key, 'State has no Done; In Progress → works');
  note(
    unticked.key,
    'In Review → refused (409), tick the entry, retry → works',
  );
  note(full.key, 'add a 7th checklist entry → refused (409)');
  note(free.key, 'Assignee shows Claim → click it, your avatar appears');
  note(yours.key, 'Assignee is you with Unclaim → click it, it is free again');
  note(
    taken.key,
    'Assignee is Mya, no button, State disabled; a direct move → 403 forbidden',
  );
  note('TM members', 'no add-member form, no Remove; you can still Leave');
};

/** Guided, self-claim off, someone else owns it and you are a member: no Claim button. */
const seedNoSelfClaim = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const { project, item } = await seedProject('TC', 'GUIDED', mya.id, [
    { userId: ownerId, role: 'MEMBER' },
    { userId: ko.id, role: 'MANAGER' },
  ]);
  await updateProject(project.id, mya.id, { selfClaimAllowed: false });
  const free = await item({
    kind: 'FEATURE',
    title:
      'Feature nobody has. Open it → no Claim button; a direct claim → 403',
  });
  const yours = await item({
    kind: 'SLICE',
    title: 'Slice assigned to you. Click Unclaim → works, it is free again',
    parentId: free.id,
    assigneeId: ownerId,
  });
  const freeEdit = await item({
    kind: 'SLICE',
    title:
      'Slice nobody has. Edit is disabled ("Only its assignee, owners and managers can edit it"); a direct edit → 403 "ask an owner or manager to assign it": no claim here, a manager assigns it',
    parentId: free.id,
  });
  note(
    freeEdit.key,
    'edit → 403 forbidden; no Claim; once a manager assigns it to you, edits work',
  );
  note(
    free.key,
    'Assignee shows no Claim button; a direct claim → 403 forbidden',
  );
  note(yours.key, 'Unclaim → works; then you cannot claim it back');
  note(
    'TC settings',
    '/p/<id>/settings shows Members can claim tickets off, read-only for you',
  );
};

/** Guided, you own it: checklistMax lowered to 3 below a checklist that already has 5. */
const seedLoweredLimits = async (ownerId: string) => {
  const [mya] = SEED_USERS;
  const { project, item } = await seedProject('TL', 'GUIDED', ownerId, [
    { userId: mya.id, role: 'MEMBER' },
  ]);
  const feature = await item({ kind: 'FEATURE', title: 'Feature' });
  const over = await item({
    kind: 'SLICE',
    title:
      'Checklist has 5 entries but the max is now 3. Add a 6th → 409 checklist_max_exceeded; tick or delete entries as usual',
    parentId: feature.id,
    state: 'In Progress',
  });
  await addEntries(over.id, ownerId, ['1', '2', '3', '4', '5'], 0);
  await updateProject(project.id, ownerId, { checklistMax: 3 });
  note(over.key, 'existing 5 entries stay; adding another → refused (409)');
  note(
    'TL settings',
    'you own it: set Minimum to 5 with Maximum 3 → 400 invalid_checklist_limits; fix and save → works',
  );
};

/** Someone else's project you're not in: its URLs must answer 404. */
const seedOutsider = async () => {
  const [, ko] = SEED_USERS;
  const { project, item } = await seedProject('TX', 'STANDARD', ko.id, []);
  const secret = await item({
    kind: 'TASK',
    title: 'You should never see this',
  });
  note(
    'TX',
    `not in your list; /p/${project.id} and /p/${project.id}/items/${secret.id} → not found`,
  );
};

/** Real submissions demonstrate the review handoff and independent recipient records. */
const seedReviewInbox = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const { project, item } = await seedProject('TI', 'GUIDED', ownerId, [
    { userId: ko.id, role: 'MANAGER' },
    { userId: mya.id, role: 'MEMBER' },
  ]);
  const states = await prisma.state.findMany({
    where: { projectId: project.id },
  });
  const review = states.find((state) => state.key === 'in_review')!.id;
  const progress = states.find((state) => state.key === 'in_progress')!.id;
  const done = states.find((state) => state.key === 'done')!.id;
  const feature = await item({
    kind: 'FEATURE',
    title: 'Review handoff examples',
  });
  const submitted = await item({
    kind: 'SLICE',
    parentId: feature.id,
    assigneeId: mya.id,
    title: 'Member submitted: only Owner or Manager may now move this task',
    state: 'In Progress',
    description:
      'Open /reviews, preview the checklist, then open this task. Return to In Progress to let the assignee revise it.',
  });
  await addEntries(
    submitted.id,
    ownerId,
    [
      'Submitting preserves the task move',
      'Owner and Manager each have their own notification',
      'Assignee cannot move while in review',
    ],
    3,
  );
  await moveItem(submitted.id, mya.id, review);
  await moveItem(submitted.id, ownerId, progress);
  await moveItem(submitted.id, mya.id, review);
  const returned = await item({
    kind: 'SLICE',
    parentId: feature.id,
    assigneeId: mya.id,
    title:
      'Returned for revision: Member can move again; previous submission stays in history',
    state: 'In Progress',
  });
  await addEntries(
    returned.id,
    ownerId,
    [
      'Reviewer can return submitted work',
      'Returning restores Member move permission',
      'History remains after return',
    ],
    3,
  );
  await moveItem(returned.id, mya.id, review);
  await moveItem(returned.id, ko.id, progress);
  const completed = await item({
    kind: 'SLICE',
    parentId: feature.id,
    assigneeId: mya.id,
    title: 'Completed: appears in notification history, outside Needs review',
    state: 'In Progress',
  });
  await addEntries(
    completed.id,
    ownerId,
    [
      'Submission recorded',
      'Owner reviews',
      'Completed work leaves review queue',
    ],
    3,
  );
  await moveItem(completed.id, mya.id, review);
  await moveItem(completed.id, ownerId, done);
  note(
    submitted.key,
    'two submissions grouped in /reviews; marking read affects only you, not Ko',
  );
  note(returned.key, 'history remains; Mya can move it again');
  note(completed.key, 'history remains; absent from Needs review');
  note(
    'TI access',
    'demote/remove Ko: his inbox hides this project; pending deliveries skip him',
  );
};

/** Documents of every kind in the guided project (you own it) and the member project. */
const seedDocuments = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const guided = await prisma.project.findFirstOrThrow({
    where: { keyPrefix: 'TG' },
  });
  const memberProject = await prisma.project.findFirstOrThrow({
    where: { keyPrefix: 'TM' },
  });
  const body = (text: string) =>
    `## ${text}\n\nMarkdown with a list:\n\n- one\n- two\n\n\`\`\`mermaid\nflowchart LR\n  A --> B\n\`\`\`\n`;

  await createDocument(guided.id, ownerId, {
    kind: 'BRIEF',
    title:
      'Brief: open it → Markdown and a diagram render; you can Edit and Archive',
    purpose: 'Shows the read page with its meta sidebar.',
    body: body('Brief'),
  });
  await createDocument(guided.id, ownerId, {
    kind: 'PROPOSAL',
    title:
      'Proposal: New document → pick another kind → the template swaps in until you type',
    purpose: 'A proposal to try the library filters on.',
    body: body('Proposal'),
  });
  await createDocument(guided.id, ownerId, {
    kind: 'SPEC',
    title: 'Spec: search "spec" in the box → only this one stays',
    purpose: 'Shows the title search and the Spec tab count.',
    body: body('Spec'),
  });
  await createDocument(guided.id, ownerId, {
    kind: 'REFERENCE',
    title:
      'Reference: architecture overview, pick the Reference tab → only this one',
    purpose: 'An architecture note, the kind used for a tech-stack overview.',
    body: body('Reference'),
  });
  const old = await createDocument(guided.id, ownerId, {
    kind: 'BRIEF',
    title: 'Archived: shows only with Show archived on; Restore brings it back',
    purpose: 'An archived brief.',
    body: body('Archived'),
  });
  await prisma.document.update({
    where: { id: old.id },
    data: { archivedAt: new Date() },
  });
  await createDocument(memberProject.id, mya.id, {
    kind: 'BRIEF',
    title: 'As a Member: Edit is hidden here',
    purpose: 'Written by the owner; you can only read it.',
    body: body('Read only'),
  });
  await createDocument(memberProject.id, ko.id, {
    kind: 'REFERENCE',
    title: 'By a Manager: you are a Member, so Edit and Archive are hidden',
    purpose: 'A manager wrote this.',
    body: body('Read only'),
  });
  await prisma.document.create({
    data: {
      projectId: memberProject.id,
      authorId: ownerId,
      kind: 'PROPOSAL',
      title: 'Yours, but you are a Member now: Edit and Archive are hidden',
      purpose: 'Only your current role counts, not who wrote it.',
      body: body('Yours'),
    },
  });
  note(
    'TG docs',
    'Knowledge: kind tabs with counts, title search, Show archived',
  );
  note(
    'TM docs',
    'Knowledge: no New document button; PATCH on any document, even your own → 403 forbidden',
  );
};

/** Ticket documents and links (plan 39): Guided features, slices, a Standard project, a member. */
const seedTicketDocuments = async (ownerId: string) => {
  const [mya] = SEED_USERS;
  const guided = await prisma.project.findFirstOrThrow({
    where: { keyPrefix: 'TG' },
  });
  const standard = await prisma.project.findFirstOrThrow({
    where: { keyPrefix: 'TS' },
  });
  const memberProject = await prisma.project.findFirstOrThrow({
    where: { keyPrefix: 'TM' },
  });

  const feature = await createProjectItem(guided.id, ownerId, {
    kind: 'FEATURE',
    title:
      'Feature with its own spec and a linked tech stack. Open it → Related shows both; New spec, Link a document and the remove buttons work',
  });
  await createTicketDocument(feature.id, ownerId, {
    kind: 'SPEC',
    title:
      'Spec: signup flow. Open it → it shows its ticket, not Linked tickets',
    purpose: 'A feature spec: stored on the ticket, hidden from Knowledge.',
    body: '## Signup flow\n\n```mermaid\nflowchart LR\n  Form --> Verify --> Welcome\n```\n',
  });
  const stack = await createDocument(guided.id, ownerId, {
    kind: 'REFERENCE',
    title:
      'Tech stack: linked to the feature above. Open it → Linked tickets lists the feature',
    purpose: 'A Knowledge reference linked to tickets.',
    body: '## Tech stack\n\n- Bun\n- Hono\n- Next.js\n',
  });
  await linkDocument(feature.id, ownerId, stack.id);
  const retired = await createDocument(guided.id, ownerId, {
    kind: 'REFERENCE',
    title:
      'Archived and linked: shows as archived in Related, and the picker will not offer it',
    purpose: 'Existing links stay when a document is archived.',
  });
  await linkDocument(feature.id, ownerId, retired.id);
  await prisma.document.update({
    where: { id: retired.id },
    data: { archivedAt: new Date() },
  });
  const slice = await createProjectItem(guided.id, ownerId, {
    kind: 'SLICE',
    title:
      'Slice of that feature. Open it → Related shows the spec and tech stack under "From" the feature, read only; linking its own document works',
    parentId: feature.id,
  });
  await createProjectItem(guided.id, ownerId, {
    kind: 'SLICE',
    title: 'Slice of that feature. Open it → the same inherited documents',
    parentId: feature.id,
  });
  const lonely = await createProjectItem(guided.id, ownerId, {
    kind: 'FEATURE',
    title:
      'Feature with nothing yet. Open it → Related is empty with New spec and Link a document; Knowledge hides its spec until "Show ticket documents" is on',
  });

  const task = await createProjectItem(standard.id, ownerId, {
    kind: 'TASK',
    title:
      'Standard project task. Open it → no Related section; POST /api/items/:id/documents/new → 409 guided_only',
  });

  const own = await createProjectItem(memberProject.id, mya.id, {
    kind: 'FEATURE',
    title:
      'Write a spec on your own ticket as a member: allowed → New spec saves it; linking a Knowledge document works too',
    assigneeId: ownerId,
  });
  const theirs = await createProjectItem(memberProject.id, mya.id, {
    kind: 'FEATURE',
    title:
      "Write a spec on someone else's ticket: refused → New spec and Link are hidden; a direct POST → 403 forbidden",
    assigneeId: mya.id,
  });
  await createTicketDocument(theirs.id, mya.id, {
    kind: 'SPEC',
    title:
      "Mya's spec on her ticket: you can read it, but Edit is hidden and a direct PATCH → 403",
    body: '## Read only for you\n',
  });
  const mcpBrief = await createProjectItem(memberProject.id, mya.id, {
    kind: 'FEATURE',
    title:
      'Create a brief over MCP as a member: refused → save_document with project TM, kind BRIEF answers forbidden',
    assigneeId: ownerId,
  });
  const mcpSpec = await createProjectItem(memberProject.id, mya.id, {
    kind: 'FEATURE',
    title:
      'Write a spec on your own ticket over MCP as a member: allowed → save_document with this ticket and kind SPEC; the same on a ticket assigned to Mya answers forbidden',
    assigneeId: ownerId,
  });
  note(mcpBrief.key, 'agent as member: save_document BRIEF → forbidden');
  note(
    mcpSpec.key,
    'agent as member: save_document SPEC on this ticket → works',
  );
  note(feature.key, 'Related: spec, tech stack, archived link; New spec, Link');
  note(slice.key, 'Related: inherited documents "From" the feature, read only');
  note(
    lonely.key,
    'New spec here, then Knowledge: hidden until Show ticket documents',
  );
  note(task.key, 'no Related section; the endpoints answer 409 guided_only');
  note(own.key, 'as a member: New spec and Link a document allowed');
  note(theirs.key, 'as a member: New spec and Link hidden; direct POST → 403');
};

/** MCP links: try as the seeded Member, whose own ticket permits linking. */
const seedMcpLinks = async (ownerId: string) => {
  const [mya] = SEED_USERS;
  const project = await prisma.project.findUniqueOrThrow({
    where: { keyPrefix: 'TM' },
  });
  const own = await createProjectItem(project.id, mya.id, {
    kind: 'FEATURE',
    assigneeId: ownerId,
    title:
      'MCP link_document on your assigned ticket → allowed; repeat → one link; unlink_document → document remains',
  });
  const proposal = await createDocument(project.id, mya.id, {
    kind: 'PROPOSAL',
    title: 'MCP proposal to link to your ticket',
    body: '## Summary\nTry link_document with the ticket key and this document id.',
  });
  const retired = await createDocument(project.id, mya.id, {
    kind: 'REFERENCE',
    title: 'Archived reference: MCP link_document → document_archived',
  });
  await prisma.document.update({
    where: { id: retired.id },
    data: { archivedAt: new Date() },
  });
  await createProjectItem(project.id, mya.id, {
    kind: 'FEATURE',
    assigneeId: mya.id,
    title:
      'MCP link_document or unlink_document on Mya’s ticket → forbidden; linking another project’s document → not_found',
  });
  note(
    own.key,
    `link_document { key: "${own.key}", id: "${proposal.id}" } → one link; ${retired.id} → document_archived`,
  );
  note(
    'TS',
    'MCP link_document/unlink_document on a Standard task → guided_only',
  );
};

/** SLO/SLA are shared Knowledge; seed both modes and current-role permissions. */
const seedReliabilityDocuments = async (ownerId: string) => {
  const [mya] = SEED_USERS;
  for (const prefix of ['TG', 'TS', 'TR', 'TM']) {
    const project = await prisma.project.findUniqueOrThrow({
      where: { keyPrefix: prefix },
    });
    const writer = prefix === 'TM' ? mya.id : ownerId;
    const slo = await createDocument(project.id, writer, {
      kind: 'SLO',
      title:
        'Draft SLO: open Knowledge → target and measurement source are placeholders',
      purpose: 'A reliability objective, not an observed production guarantee.',
      body: '## Service / journey\nSave a work item.\n\n## Indicator (SLI)\nSuccessful valid saves / eligible save attempts.\n\n## Target and window\nTBD after a baseline.\n\n## Measurement source\nVerify instrumentation before adopting this objective.\n\n## Owner\nTBD.\n\n## Exclusions\nTBD.\n\n## Response policy\nInvestigate user impact and prioritize reliability fixes.',
    });
    const sla = await createDocument(project.id, writer, {
      kind: 'SLA',
      title:
        'Draft SLA: open Knowledge → supporting SLO link works; no acceptance or service guarantee is recorded',
      body: `## Audience / customer\nTBD.\n\n## Service commitments\nDraft placeholders only.\n\n## Measurement terms\nTBD.\n\n## Exclusions\nTBD.\n\n## Remedies\nTBD.\n\n## Effective dates\nTBD.\n\n## Accountable owner\nTBD.\n\n## Agreement state\nDraft; no acceptance recorded by Uniloom.\n\n## Supporting SLOs\n[Draft SLO](/p/${project.id}/docs/${slo.id})`,
    });
    const own = await createProjectItem(project.id, writer, {
      kind: project.mode === 'GUIDED' ? 'FEATURE' : 'TASK',
      assigneeId: ownerId,
      title:
        prefix === 'TM'
          ? 'As Member: read SLO/SLA → allowed; edit or archive → forbidden; linking to this assigned Guided ticket → allowed'
          : project.mode === 'GUIDED'
            ? 'Link SLO/SLA → allowed; creating either as a ticket document → invalid_input; accepting either as ADR → refused'
            : 'Create/edit/archive SLO/SLA in Standard Knowledge → allowed; linking to a Standard task → guided_only',
    });
    if (project.mode === 'GUIDED') {
      await linkDocument(own.id, writer, slo.id);
      await linkDocument(own.id, writer, sla.id);
    }
    note(
      own.key,
      `SLO ${slo.id}; SLA ${sla.id}: project Knowledge with no number/status; ${prefix === 'TR' ? 'you write as Manager' : prefix === 'TM' ? 'you read as Member' : 'you write as Owner'}`,
    );
  }
};

/** Provenance examples across modes and roles, with explicit manual failure cases. */
const seedSpecProvenance = async (ownerId: string) => {
  const [mya] = SEED_USERS;
  for (const prefix of ['TG', 'TS', 'TR', 'TM']) {
    const project = await prisma.project.findUniqueOrThrow({
      where: { keyPrefix: prefix },
    });
    const writer = prefix === 'TM' ? mya.id : ownerId;
    const proposal = await createDocument(project.id, writer, {
      kind: 'PROPOSAL',
      title:
        'Proposal: open → multiple derived specs link back; approval is not required',
    });
    const replacement = await createDocument(project.id, writer, {
      kind: 'PROPOSAL',
      title:
        'Replacement: edit a spec → choose this, save → backlink moves here',
    });
    await createDocument(project.id, writer, {
      kind: 'SPEC',
      title:
        'Independent spec: save with no proposal → allowed; ticket workflow is unchanged',
    });
    await createDocument(project.id, writer, {
      kind: 'SPEC',
      title:
        'Derived spec A: edit → clear or replace source → allowed for Owner/Manager',
      sourceProposalId: proposal.id,
    });
    await createDocument(project.id, writer, {
      kind: 'SPEC',
      title: 'Derived spec B: same proposal → allowed; proposal lists both',
      sourceProposalId: proposal.id,
    });
    const archived = await createDocument(project.id, writer, {
      kind: 'PROPOSAL',
      title:
        'Archived source: existing spec keeps link; new associations → document_archived',
    });
    await createDocument(project.id, writer, {
      kind: 'SPEC',
      title:
        'Archived-source spec: body-only save or same source → allowed; remove → allowed',
      sourceProposalId: archived.id,
    });
    await updateDocumentById(archived.id, writer, { archived: true });
    const item = await createProjectItem(project.id, writer, {
      kind: project.mode === 'GUIDED' ? 'FEATURE' : 'TASK',
      assigneeId: ownerId,
      title:
        prefix === 'TM'
          ? 'As assigned Member: create/edit ticket spec source → allowed; edit Knowledge spec or unassigned ticket → forbidden'
          : 'MCP sourceProposalId: wrong kind/non-SPEC even null → invalid_source_proposal; missing/foreign project → not_found',
    });
    if (project.mode === 'GUIDED')
      await createTicketDocument(item.id, writer, {
        kind: 'SPEC',
        title:
          'Ticket spec: proposal backlink includes ticket; delete home ticket → backlink hidden',
        sourceProposalId: proposal.id,
      });
    note(
      item.key,
      `Proposal ${proposal.id}; replacement ${replacement.id}; archived ${archived.id}. Standard supports Knowledge specs; ticket creation → guided_only. Relationship changes preserve ticket state and unrelated links.`,
    );
  }
};

const seedAdrs = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const guided = await prisma.project.findFirstOrThrow({
    where: { keyPrefix: 'TG' },
  });
  const memberProject = await prisma.project.findFirstOrThrow({
    where: { keyPrefix: 'TM' },
  });

  // In TG you own the project and Ko is a Member: Ko raised this one from her ticket.
  const kos = await createProjectItem(guided.id, ownerId, {
    kind: 'FEATURE',
    title:
      'Ko raised an ADR from this ticket. Open it → Related lists it Proposed; open the ADR → Accept and Reject work (you are the owner); Ko cannot edit it',
    assigneeId: ko.id,
  });
  const raised = await createTicketDocument(kos.id, ko.id, {
    kind: 'ADR',
    title: 'Use Postgres for storage',
    purpose: 'Raised by a member from their ticket.',
    body: '## Context\n\n## Options\n\n## Decision\n\n## Consequences\n',
  });
  // In TM you are a Member and Mya owns it.
  const mine = await createProjectItem(memberProject.id, mya.id, {
    kind: 'FEATURE',
    title:
      'Raise an ADR from your own ticket as a member: allowed → New ADR saves it Proposed in Knowledge, linked here; you cannot accept it, an owner or manager can',
    assigneeId: ownerId,
  });
  const notMine = await createProjectItem(memberProject.id, mya.id, {
    kind: 'FEATURE',
    title:
      "Raise an ADR from someone else's ticket as a member: refused → New ADR is hidden; a direct POST /api/items/:id/documents/new → 403 forbidden",
    assigneeId: mya.id,
  });

  await createDocument(guided.id, ownerId, {
    kind: 'ADR',
    title:
      'Proposed ADR. Open it as owner → Accept and Reject show; as a member they do not',
    body: '## Context\n\n## Options\n\n## Decision\n\n## Consequences\n',
  });
  const rejected = await createDocument(guided.id, ownerId, {
    kind: 'ADR',
    title:
      'Rejected ADR. Open it → status Rejected, no buttons; archiving it → 409 adr_not_archivable',
    body: '## Decision\n\nWe will not do this.\n',
  });
  await setDocumentStatus(rejected.id, ownerId, { status: 'REJECTED' });
  const old = await createDocument(guided.id, ownerId, {
    kind: 'ADR',
    title:
      'Superseded ADR. Open it → "Superseded by ADR" with a link to the newer one',
    body: '## Decision\n\nThe first choice.\n',
  });
  await setDocumentStatus(old.id, ownerId, { status: 'ACCEPTED' });
  const newer = await createDocument(guided.id, ownerId, {
    kind: 'ADR',
    title:
      'Accepted ADR that replaced the one above. Open it → Accepted; editing its body keeps it Accepted',
    body: '## Decision\n\nThe better choice.\n',
  });
  await setDocumentStatus(newer.id, ownerId, { status: 'ACCEPTED' });
  await setDocumentStatus(old.id, ownerId, {
    status: 'SUPERSEDED',
    supersededById: newer.id,
  });
  note(
    kos.key,
    `Ko's ADR-${raised.number} is Proposed and linked: accept it as owner`,
  );
  note(mine.key, 'as a member: New ADR allowed, then cannot accept it');
  note(notMine.key, 'as a member: New ADR hidden; direct POST → 403');
  note('Knowledge → ADRs', 'Proposed, Rejected, Superseded and Accepted ADRs');
};

const seedTechDebt = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const guided = await prisma.project.findFirstOrThrow({
    where: { keyPrefix: 'TG' },
  });
  const memberProject = await prisma.project.findFirstOrThrow({
    where: { keyPrefix: 'TM' },
  });
  const done = await prisma.state.findFirstOrThrow({
    where: { projectId: guided.id, key: 'done' },
  });

  // In TG you own the project and Ko is a Member: Ko found this debt on her ticket.
  const kos = await createProjectItem(guided.id, ownerId, {
    kind: 'FEATURE',
    title:
      "Ko raised tech debt from this ticket. Open it → Related lists TD Open; open the debt → Fixed and Won't fix show (you are the owner); Ko cannot edit it",
    assigneeId: ko.id,
  });
  const open = await createTicketDocument(kos.id, ko.id, {
    kind: 'TECH_DEBT',
    title: "Open tech debt raised by a member: close it as Won't fix",
    purpose: 'Raised by a member from their ticket.',
    body: 'The import loop reads every row twice.\n',
  });

  // Fixed: the debt was found on one ticket and fixed by a Done one.
  const found = await createProjectItem(guided.id, ownerId, {
    kind: 'FEATURE',
    title:
      'Tech debt was found on this ticket. Open it → Related lists the debt as Fixed',
  });
  const fixer = await createProjectItem(guided.id, ownerId, {
    kind: 'FEATURE',
    title:
      'Done ticket that fixed a debt. Open it → Related lists the debt, linked when it was marked Fixed',
    stateId: done.id,
  });
  const fixed = await createTicketDocument(found.id, ownerId, {
    kind: 'TECH_DEBT',
    title: 'Fixed tech debt. Open it → Fixed by names the Done ticket',
    body: 'A copy-pasted validation.\n',
  });
  await setDocumentStatus(fixed.id, ownerId, {
    status: 'FIXED',
    fixedByItemId: fixer.id,
  });

  // Refused: the only other ticket is not Done.
  const notDone = await createProjectItem(guided.id, ownerId, {
    kind: 'FEATURE',
    title:
      'Not Done yet. Name this ticket as the fix of the debt "Mark this Fixed with a ticket that isn\'t Done" → 409 fix_not_done',
  });
  const refused = await createTicketDocument(found.id, ownerId, {
    kind: 'TECH_DEBT',
    title:
      "Mark this Fixed with a ticket that isn't Done: refused (pick the Not Done ticket → 409 fix_not_done)",
  });

  // In TM you are a Member and Mya owns it.
  const mine = await createProjectItem(memberProject.id, mya.id, {
    kind: 'FEATURE',
    title:
      'Raise tech debt from your own ticket as a member: allowed → Raise tech debt saves it Open, linked here; you cannot close it, an owner or manager can',
    assigneeId: ownerId,
  });
  const notMine = await createProjectItem(memberProject.id, mya.id, {
    kind: 'FEATURE',
    title:
      "Raise tech debt from someone else's ticket as a member: refused → Raise tech debt is hidden; a direct POST /api/items/:id/documents/new → 403 forbidden",
    assigneeId: mya.id,
  });
  note(kos.key, `Ko's TD-${open.number} is Open and linked: close it as owner`);
  note(found.key, `TD-${fixed.number} is Fixed; TD-${refused.number} is Open`);
  note(fixer.key, `Done: it fixed TD-${fixed.number}`);
  note(
    notDone.key,
    `Not Done: naming it as the fix of TD-${refused.number} → 409`,
  );
  note(mine.key, 'as a member: Raise tech debt allowed, then cannot close it');
  note(notMine.key, 'as a member: Raise tech debt hidden; direct POST → 403');
  note('Knowledge → Tech debt', 'Open, Fixed and refused-to-fix debts');
};

/** Comments (plan 52): one ticket with a nested thread, an edited and a deleted comment. */
const seedComments = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const guided = await prisma.project.findFirstOrThrow({
    where: { keyPrefix: 'TG' },
  });
  // In TG you own the project, Mya is a Manager and Ko a Member.
  const ticket = await createProjectItem(guided.id, ownerId, {
    kind: 'FEATURE',
    title:
      'Comments: open it → a thread below History; you (owner) see Delete on every comment but Edit only on yours; Mya (manager) can delete too, Ko (member) only her own',
  });
  const first = await createItemComment(ticket.id, ko.id, {
    body: 'Can we ship this before the demo? See https://example.com/demo for the plan.',
  });
  const reply = await createItemComment(ticket.id, ownerId, {
    body: 'You wrote the first comment, you have the Author badge on this one: yes, if the checklist is ticked.',
    parentId: first.id,
  });
  const deep = await createItemComment(ticket.id, ko.id, {
    body: 'Level 3. Click the coloured bar on the left → the thread collapses to "Show replies (n)".',
    parentId: reply.id,
  });
  await createItemComment(ticket.id, mya.id, {
    body: 'Level 4, and the bar changes colour at each depth.',
    parentId: deep.id,
  });

  const edited = await createItemComment(ticket.id, ownerId, {
    body: 'This says "(edited)" next to the time. Use Edit → only your own comments have it.',
  });
  await updateComment(edited.id, ownerId, {
    body: 'This one was edited: it says "(edited)" next to the time. Edit it again → still one "(edited)".',
  });

  const gone = await createItemComment(ticket.id, ko.id, {
    body: 'Ko deleted this comment.',
  });
  await createItemComment(ticket.id, mya.id, {
    body: 'A live reply under a deleted comment: the parent reads "This comment was deleted." by "Deleted user", this stays. Reply to the parent is not offered.',
    parentId: gone.id,
  });
  await deleteComment(gone.id, ko.id);
  note(
    'TG',
    'ticket "Comments: open it ..." → the thread: Author badge, nested replies with collapse, an "(edited)" comment, a deleted comment keeping its reply; Shift+Enter in the composer posts',
  );
};

const seedDocumentComments = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const guided = await prisma.project.findFirstOrThrow({
    where: { keyPrefix: 'TG' },
  });

  // A Knowledge document you wrote: your comments carry the Author badge.
  const knowledge = await createDocument(guided.id, ownerId, {
    kind: 'REFERENCE',
    title:
      'Reference with comments: open it → a thread under the article; your comments have the Author badge; Reply to Ko → it nests',
    purpose: 'Shows comments on a Knowledge document.',
    body: '## Reference\n\nComment on this page.\n',
  });
  const question = await createDocumentComment(knowledge.id, ko.id, {
    body: 'Is this still current? Ko asks from the Member role.',
  });
  await createDocumentComment(knowledge.id, ownerId, {
    body: 'Yes. You wrote this document, so this reply has the Author badge.',
    parentId: question.id,
  });

  // A spec owned by a ticket: its comments follow the ticket, and vanish if it is deleted.
  const ticket = await createProjectItem(guided.id, ownerId, {
    kind: 'FEATURE',
    title:
      'Ticket with a spec that has comments: open its spec → a thread under it; delete this ticket → the spec and its comments answer not found',
  });
  const spec = await createTicketDocument(ticket.id, ownerId, {
    kind: 'SPEC',
    title:
      'Spec with comments: reply to Mya, then delete your reply → a placeholder',
    purpose: 'Shows comments on a ticket-owned document.',
    body: '## Spec\n\nComment on this spec.\n',
  });
  const first = await createDocumentComment(spec.id, mya.id, {
    body: 'Mya (manager) comments on the spec.',
  });
  await createDocumentComment(spec.id, ko.id, {
    body: 'Ko (member) replies in the same thread.',
    parentId: first.id,
  });
  note(
    'TG',
    'documents "Reference with comments" and "Spec with comments" → each shows a thread with an Author badge on the document author',
  );
};

/**
 * Invite links (plan 43): one you manage, and three to projects you're not in. Open each
 * printed path on the web app's origin.
 */
const seedInvites = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const day = {
    expiresIn: '24h' as const,
    maxUses: null,
    joinApproval: false,
  };

  const { project: yours } = await seedProject('TV', 'STANDARD', ownerId, []);
  const live = await createInvite(yours.id, ownerId, {
    expiresIn: '7d',
    maxUses: 10,
    joinApproval: false,
  });
  await joinByInvite(live.token, mya.id);
  await joinByInvite(live.token, ko.id);
  note(
    'TV',
    'Members: the Invite link card shows the link, "2 of 10 people joined", who created it and the exact expiry and when it expires; Copy link and Copy invite message work; Create new link and Delete link ask first; Remove on Mya asks and offers to delete the link too',
  );

  const { project: open } = await seedProject('TO', 'STANDARD', ko.id, []);
  const openLink = await createInvite(open.id, ko.id, day);
  note(
    'TO',
    `/join/${openLink.token} → "Join Seed · Open invite", invited by Ko; Join project → its board, you are a Member; open the link again → straight to the board`,
  );

  const { project: full } = await seedProject('TF', 'STANDARD', ko.id, []);
  const fullLink = await createInvite(full.id, ko.id, {
    expiresIn: '24h',
    maxUses: 1,
    joinApproval: false,
  });
  await joinByInvite(fullLink.token, mya.id);
  note(
    'TF',
    `/join/${fullLink.token} → "This invite link has reached its limit", no project name, no Join button`,
  );

  const { project: expired } = await seedProject('TE', 'STANDARD', ko.id, []);
  const expiredLink = await createInvite(expired.id, ko.id, day);
  await prisma.invite.update({
    where: { token: expiredLink.token },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  note(
    'TE',
    `/join/${expiredLink.token} → "This invite link has expired"; /join/not-a-link → "This invite link doesn't work"`,
  );
};

/** Links that need approval (plan 44): requests waiting for you, and a link to ask through. */
const seedJoinRequests = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const approval = {
    expiresIn: '7d' as const,
    maxUses: 10,
    joinApproval: true,
  };

  const { project: yours } = await seedProject('TA', 'STANDARD', ownerId, []);
  const link = await createInvite(yours.id, ownerId, approval);
  await joinByInvite(link.token, mya.id);
  await joinByInvite(link.token, ko.id);
  note(
    'TA',
    'Members: "Join requests" lists Mya and Ko above the members and the sidebar shows 2; Approve Mya → she moves to the member list; Decline Ko → he leaves the list; the link still says "2 of 10 requests"; Create new link keeps waiting requests',
  );

  const { project: theirs } = await seedProject('TQ', 'STANDARD', ko.id, []);
  const ask = await createInvite(theirs.id, ko.id, approval);
  note(
    'TQ',
    `/join/${ask.token} → "Ask to join", then "Request sent"; the project is not in your list and its board answers not found until someone approves`,
  );
};

/** Your own requests (plan 45): one that waits, and one Ko declined. */
const seedMyRequests = async (ownerId: string) => {
  const [, ko] = SEED_USERS;
  const approval = {
    expiresIn: '7d' as const,
    maxUses: 10,
    joinApproval: true,
  };

  const { project: waiting } = await seedProject('TW', 'STANDARD', ko.id, []);
  const waitLink = await createInvite(waiting.id, ko.id, approval);
  await joinByInvite(waitLink.token, ownerId);
  note(
    'TW',
    `Projects: "Waiting for approval" lists Seed · Waiting with Cancel request; /join/${waitLink.token} → "waiting for an owner or manager" with Cancel request; cancel → the row is gone and the link offers Ask again`,
  );

  const { project: declined } = await seedProject('TD', 'STANDARD', ko.id, []);
  const declinedLink = await createInvite(declined.id, ko.id, approval);
  await joinByInvite(declinedLink.token, ownerId);
  const [request] = await listJoinRequests(declined.id, ko.id);
  await decideJoinRequest(declined.id, ko.id, request!.id, false);
  note(
    'TD',
    `not under "Waiting for approval"; /join/${declinedLink.token} → "Your request to join Seed · Declined was declined" with Ask again → it waits again`,
  );
};

/** Deleting a project (plan 51): you own one, manage one, and an old link points at a deleted one. */
const seedDeleteProject = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const { item } = await seedProject('TZ', 'STANDARD', ownerId, [
    { userId: mya.id, role: 'MANAGER' },
    { userId: ko.id, role: 'MEMBER' },
  ]);
  await item({
    kind: 'TASK',
    title:
      'Task. Settings → Delete project, type "Seed · Delete me", Delete → back on the project list, this project is gone and its link answers 404',
  });
  await item({
    kind: 'TASK',
    title:
      'Task. In Delete project, type a wrong name → the Delete button stays disabled',
  });
  note(
    'TZ',
    'you are the OWNER: Settings shows "Delete project"; after deleting, /p/<id> and its items answer not found',
  );

  const { project: managed, item: managedItem } = await seedProject(
    'TU',
    'STANDARD',
    mya.id,
    [
      { userId: ownerId, role: 'MANAGER' },
      { userId: ko.id, role: 'MEMBER' },
    ],
  );
  await managedItem({
    kind: 'TASK',
    title:
      'Task. Open Settings → no "Delete project" section, you are a manager; DELETE /api/projects/<id> → 403 forbidden',
  });
  await createInvite(managed.id, mya.id, {
    expiresIn: '7d',
    maxUses: null,
    joinApproval: false,
  });
  note('TU', 'you are a MANAGER: Settings has no "Delete project" section');

  const { project: gone } = await seedProject('TK', 'STANDARD', ko.id, []);
  const oldLink = await createInvite(gone.id, ko.id, {
    expiresIn: '7d',
    maxUses: null,
    joinApproval: false,
  });
  await prisma.project.update({
    where: { id: gone.id },
    data: { deletedAt: new Date() },
  });
  note(
    'TK',
    `deleted project: /join/${oldLink.token} → "This invite link doesn't work"; it is not on your project list; its key TK stays reserved (TD-022)`,
  );
};

const [owner, ...others] = await findOwners();
for (const user of SEED_USERS)
  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: user,
  });
await removeOldSeed();
await seedGuided(owner.id);
await seedStandard(owner.id);
await seedManager(owner.id);
await seedMember(owner.id);
await seedNoSelfClaim(owner.id);
await seedLoweredLimits(owner.id);
await seedOutsider();
await seedReviewInbox(owner.id);
await seedDocuments(owner.id);
await seedTicketDocuments(owner.id);
await seedMcpLinks(owner.id);
await seedReliabilityDocuments(owner.id);
await seedSpecProvenance(owner.id);
await seedAdrs(owner.id);
await seedTechDebt(owner.id);
await seedComments(owner.id);
await seedDocumentComments(owner.id);
await seedInvites(owner.id);
await seedJoinRequests(owner.id);
await seedMyRequests(owner.id);
await seedDeleteProject(owner.id);
await addOtherOwners(
  owner.id,
  others.map((user) => user.id),
);
console.log(
  `Seeded for ${[owner, ...others].map((user) => user.name).join(' and ')}. Try:\n  ${checks.join('\n  ')}`,
);
await prisma.$disconnect();
