// Fills the dev database with test projects that show every rule built so far, so each
// case can be tried in the browser. Run `bun run db:seed` after signing in once.
//
// SEED_OWNER_EMAIL picks your account (default: the first user who signed in). Reruns
// replace the seed projects (keys TG, TS, TR, TX) and never touch any other project.
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
  addBlocker,
  addChecklistEntry,
  createProjectItem,
  removeItem,
  updateChecklistEntry,
} from '../src/modules/items/item.service.js';
import { createProject } from '../src/modules/projects/project.service.js';

const SEED_PROJECTS = {
  TG: 'Seed · Guided',
  TS: 'Seed · Standard',
  TR: 'Seed · Manager',
  TM: 'Seed · Member',
  TX: 'Seed · Not a member',
};

/** Fake people, so there are assignees, authors and an owner who isn't you. */
const SEED_USERS = [
  { id: 'seed-mya', name: 'Mya (seed)', email: 'seed-mya@example.com' },
  { id: 'seed-ko', name: 'Ko (seed)', email: 'seed-ko@example.com' },
];

const findOwner = async () => {
  const email = process.env.SEED_OWNER_EMAIL;
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({
        where: { id: { notIn: SEED_USERS.map((u) => u.id) } },
        orderBy: { createdAt: 'asc' },
      });
  if (!user)
    throw new Error(
      'No user to own the seed projects: sign in to Uniloom once first (or check SEED_OWNER_EMAIL)',
    );
  return user;
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

const checks: string[] = [];
const note = (key: string, what: string) => checks.push(`${key}  ${what}`);

/** Guided, you own it: every column, kinds, parents, blocked-by and the trash. */
const seedGuided = async (ownerId: string) => {
  const [mya, ko] = SEED_USERS;
  const { item } = await seedProject('TG', 'GUIDED', ownerId, [
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
    title: 'Slice in Aligning. Move it to Ready → works for any member',
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
  const { item } = await seedProject('TM', 'GUIDED', mya.id, [
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
      'Slice. Move it to another column, edit it, set a blocker → all work',
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
    title: "Slice assigned to Mya. Open it → no Claim, you can't take it",
    parentId: feature.id,
    assigneeId: mya.id,
  });
  note(
    'TM',
    'you are a MEMBER here: no New item, Add subtask, Delete or Restore',
  );
  note(
    slice.key,
    'drag to another column, edit the title, set a blocker → works',
  );
  note(free.key, 'Assignee shows Claim → click it, your avatar appears');
  note(yours.key, 'Assignee is you with Unclaim → click it, it is free again');
  note(taken.key, 'Assignee is Mya, no button; a direct PATCH → 403 forbidden');
  note('TM members', 'no add-member form, no Remove; you can still Leave');
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

const owner = await findOwner();
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
await seedOutsider();
console.log(`Seeded for ${owner.name}. Try:\n  ${checks.join('\n  ')}`);
await prisma.$disconnect();
