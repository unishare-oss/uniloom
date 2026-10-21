import { randomUUID } from 'node:crypto';
import { prisma } from '@/db/prisma.js';
import { DIRECTORY_CLIENT } from './support/mock-uniauth.js';
import { startTestApi, read } from './support/test-app.js';

const freshPrefix = () =>
  Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

describe('v1 identity events and reconciliation (e2e)', () => {
  let api: Awaited<ReturnType<typeof startTestApi>>;
  let reconcileIdentities: () => Promise<{
    applied: number;
    resynced: boolean;
  }>;
  const OLD_AUDIENCE = 'machine-client-before-rotation';

  beforeAll(async () => {
    // Events may still name the old machine client during a rotation overlap.
    process.env.UNIAUTH_EVENTS_EXTRA_AUDIENCES = OLD_AUDIENCE;
    api = await startTestApi();
    ({ reconcileIdentities } =
      await import('@/modules/uniauth/identity-events.service.js'));
  });

  afterAll(async () => {
    await prisma.project.deleteMany({
      where: {
        members: {
          some: { user: { email: { endsWith: `@${api.emailDomain}` } } },
        },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: `@${api.emailDomain}` } },
    });
    await prisma.identityEventReceipt.deleteMany({});
    await prisma.identityReconcile.deleteMany({});
    await prisma.$disconnect();
    await api?.close();
  });

  const post = (token: string) =>
    api.call('/api/uniauth/identity-events', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });

  /** Sends an event for `sub` the way uniAuth's outbox would. */
  const send = async (
    sub: string,
    type: string,
    identityVersion: number,
    eventId: string = randomUUID(),
    audience = DIRECTORY_CLIENT.id,
  ) =>
    post(
      await api.uniauth.signIdentityEvent(
        sub,
        { eventId, type, identityVersion },
        audience,
      ),
    );

  /** A person who signed in to Uniloom (so it knows them), with their local row. */
  const person = async (name = 'Mya') => {
    const profile = api.newProfile({ name });
    const session = await api.signIn(profile);
    const row = await prisma.user.findUniqueOrThrow({
      where: { email: profile.email },
    });
    return { profile, cookie: session.cookie, id: row.id, sub: profile.sub };
  };
  const local = (id: string) =>
    prisma.user.findUniqueOrThrow({ where: { id } });

  it('applies an update fetched from the directory, and ignores a duplicate and an older version', async () => {
    const p = await person('Before');
    api.uniauth.setIdentity(p.sub, { version: 2, name: 'Second' });
    expect((await send(p.sub, 'identity.updated', 2, 'evt-a')).status).toBe(
      204,
    );
    expect(await local(p.id)).toMatchObject({
      name: 'Second',
      identityVersion: 2,
    });

    // The same event again (uniAuth delivers at least once): nothing changes, even if the directory moved on.
    api.uniauth.setIdentity(p.sub, { version: 2, name: 'Changed under us' });
    expect((await send(p.sub, 'identity.updated', 2, 'evt-a')).status).toBe(
      204,
    );
    expect((await local(p.id)).name).toBe('Second');

    // An older event arriving late must not undo anything.
    expect((await send(p.sub, 'identity.updated', 1, 'evt-old')).status).toBe(
      204,
    );
    expect(await local(p.id)).toMatchObject({
      name: 'Second',
      identityVersion: 2,
    });

    // A newer one applies.
    api.uniauth.setIdentity(p.sub, { version: 3, name: 'Third' });
    expect((await send(p.sub, 'identity.updated', 3)).status).toBe(204);
    expect(await local(p.id)).toMatchObject({
      name: 'Third',
      identityVersion: 3,
    });
    expect(
      await prisma.identityEventReceipt.count({ where: { subject: p.sub } }),
    ).toBe(3);
  });

  it('suspension blocks the person at once and ends their sessions; reactivation lets them back without old sessions', async () => {
    const p = await person();
    expect((await api.send('GET', '/api/me', p.cookie)).status).toBe(200);
    expect((await send(p.sub, 'identity.suspended', 2)).status).toBe(204);
    expect(await local(p.id)).toMatchObject({
      identityStatus: 'suspended',
      identityVersion: 2,
    });
    expect((await api.send('GET', '/api/me', p.cookie)).status).toBe(401); // the old session is gone
    expect(await prisma.session.count({ where: { userId: p.id } })).toBe(0);

    // A session that somehow exists is still refused while suspended.
    const again = await api.signIn(p.profile);
    const blocked = await api.send('GET', '/api/me', again.cookie);
    expect([blocked.status, (await read(blocked)).code]).toEqual([
      403,
      'account_suspended',
    ]);

    expect((await send(p.sub, 'identity.reactivated', 3)).status).toBe(204);
    expect(await local(p.id)).toMatchObject({
      identityStatus: 'active',
      identityVersion: 3,
    });
    expect((await api.send('GET', '/api/me', again.cookie)).status).toBe(200);
    // Out of order: a late suspension with an older version does nothing.
    expect((await send(p.sub, 'identity.suspended', 2)).status).toBe(204);
    expect((await local(p.id)).identityStatus).toBe('active');
  });

  it('deletion keeps the existing behavior, and an older update cannot bring the person back', async () => {
    const owner = await api.signInReady();
    const res = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'W',
      keyPrefix: freshPrefix(),
      mode: 'STANDARD',
    });
    const { id: projectId } = (await read(res)) as { id: string };
    const p = await person();
    await prisma.member.create({
      data: { projectId, userId: p.id, role: 'MEMBER' },
    });

    expect((await send(p.sub, 'identity.deleted', 4)).status).toBe(204);
    expect(await prisma.user.count({ where: { id: p.id } })).toBe(0);
    expect(await prisma.member.count({ where: { userId: p.id } })).toBe(0); // memberships go with the user, as before
    expect(await prisma.account.count({ where: { accountId: p.sub } })).toBe(0);

    api.uniauth.setIdentity(p.sub, { version: 3 });
    expect((await send(p.sub, 'identity.updated', 3)).status).toBe(204); // late and stale: nobody is created
    expect(await prisma.user.count({ where: { email: p.profile.email } })).toBe(
      0,
    );
  });

  it('refuses tokens it cannot verify, accepts the connection check, and never creates a user from an event', async () => {
    const p = await person();
    const good = await api.uniauth.signIdentityEvent(
      p.sub,
      { eventId: 'x1', type: 'identity.suspended', identityVersion: 9 },
      DIRECTORY_CLIENT.id,
    );
    // Wrong audience, and a tampered signature: 401 (uniAuth retries these).
    const wrongAudience = await api.uniauth.signIdentityEvent(
      p.sub,
      { eventId: 'x2', type: 'identity.suspended', identityVersion: 9 },
      'someone-else',
    );
    expect((await post(wrongAudience)).status).toBe(401);
    expect((await post(`${good.slice(0, -4)}AAAA`)).status).toBe(401);
    expect((await post('not-a-token')).status).toBe(401);
    expect((await local(p.id)).identityStatus).toBe('active');
    // The old machine client's audience is accepted during a rotation overlap.
    expect(
      (await send(p.sub, 'identity.updated', 5, randomUUID(), OLD_AUDIENCE))
        .status,
    ).not.toBe(401);

    // A verified token that is not a v1 identity event is final (400); a body that is not a token too.
    const legacy = await api.uniauth.signEvent(p.sub, {
      'urn:uniauth:event:user-deleted': {},
    });
    expect((await post(legacy)).status).toBe(401); // legacy tokens are for the login client's audience
    const mismatched = await api.uniauth.signIdentityEvent(
      p.sub,
      { eventId: 'x3', type: 'identity.suspended', identityVersion: 9 },
      DIRECTORY_CLIENT.id,
      { schemaVersion: 2 },
    );
    expect((await post(mismatched)).status).toBe(400);
    expect(
      (
        await api.call('/api/uniauth/identity-events', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: '',
        })
      ).status,
    ).toBe(400);

    // The dashboard's connection check is acknowledged and changes nothing.
    const check = await api.uniauth.signRaw(
      'connection-check',
      { 'urn:uniauth:event:connection-check': { synthetic: true } },
      DIRECTORY_CLIENT.id,
    );
    expect((await post(check)).status).toBe(204);
    expect(
      await prisma.account.count({ where: { accountId: 'connection-check' } }),
    ).toBe(0);

    // About a person this app has never seen: acknowledged, nothing created.
    const stranger = `u_${randomUUID()}`;
    expect((await send(stranger, 'identity.updated', 1)).status).toBe(204);
    expect(await prisma.account.count({ where: { accountId: stranger } })).toBe(
      0,
    );
    // An unknown future event type is acknowledged too.
    expect((await send(p.sub, 'identity.something-new', 12)).status).toBe(204);
  });

  it('answers 503 when it cannot fetch the profile, and applies the retry', async () => {
    const p = await person('Stays');
    api.uniauth.setIdentity(p.sub, { version: 2, name: 'Fetched later' });
    api.uniauth.directory.failWith = 500;
    try {
      expect(
        (await send(p.sub, 'identity.updated', 2, 'evt-retry')).status,
      ).toBe(503);
    } finally {
      api.uniauth.directory.failWith = 0;
    }
    expect(
      await prisma.identityEventReceipt.count({
        where: { eventId: 'evt-retry' },
      }),
    ).toBe(0); // not recorded as applied
    expect((await send(p.sub, 'identity.updated', 2, 'evt-retry')).status).toBe(
      204,
    ); // uniAuth's retry
    expect((await local(p.id)).name).toBe('Fetched later');
  });

  it('reconciles from the change feed after being offline, in order and only once', async () => {
    await prisma.identityReconcile.deleteMany({});
    api.uniauth.feed.length = 0;
    api.uniauth.feedState.gone = false;
    const a = await person('A');
    const b = await person('B');
    const stranger = `u_${randomUUID()}`;
    api.uniauth.setIdentity(a.sub, {
      version: 2,
      name: 'A updated while offline',
    });
    api.uniauth.setIdentity(b.sub, { version: 2, status: 'suspended' });
    api.uniauth.feed.push(
      { eventId: 'feed-1', type: 'identity.updated', id: a.sub, version: 2 },
      { eventId: 'feed-2', type: 'identity.suspended', id: b.sub, version: 2 },
      { eventId: 'feed-3', type: 'identity.updated', id: stranger, version: 1 }, // not one of ours
    );
    expect(await reconcileIdentities()).toEqual({
      applied: 2,
      resynced: false,
      skipped: 0,
      stopped: false,
    });
    expect(await local(a.id)).toMatchObject({
      name: 'A updated while offline',
      identityVersion: 2,
    });
    expect(await local(b.id)).toMatchObject({
      identityStatus: 'suspended',
      identityVersion: 2,
    });
    expect(
      (await prisma.identityReconcile.findUniqueOrThrow({ where: { id: 1 } }))
        .cursor,
    ).toBe('3');

    // Nothing new: nothing applied. A new change after the cursor is picked up.
    expect((await reconcileIdentities()).applied).toBe(0);
    api.uniauth.setIdentity(b.sub, { version: 3, status: 'active' });
    api.uniauth.feed.push({
      eventId: 'feed-4',
      type: 'identity.reactivated',
      id: b.sub,
      version: 3,
    });
    expect((await reconcileIdentities()).applied).toBe(1);
    expect((await local(b.id)).identityStatus).toBe('active');

    // The event also arrives the normal way after the feed applied it: a duplicate by version, no change.
    expect(
      (await send(b.sub, 'identity.reactivated', 3, 'feed-4')).status,
    ).toBe(204);
  });

  it('resyncs every known account with batch reads when the cursor is older than uniAuth retention', async () => {
    api.uniauth.feed.length = 0;
    api.uniauth.feedState.gone = false;
    await prisma.identityReconcile.deleteMany({});
    const keep = await person('Keep');
    const gone = await person('Gone');
    const suspended = await person('Suspend');
    await prisma.identityReconcile.create({ data: { id: 1, cursor: '7' } }); // far behind a pruned feed
    api.uniauth.feedState.gone = true;
    api.uniauth.setIdentity(keep.sub, { version: 9, name: 'Kept, renamed' });
    api.uniauth.setIdentity(gone.sub, { version: 9, status: 'deleted' });
    api.uniauth.setIdentity(suspended.sub, { version: 9, status: 'suspended' });

    const result = await reconcileIdentities();
    expect(result.resynced).toBe(true);
    expect(await local(keep.id)).toMatchObject({
      name: 'Kept, renamed',
      identityVersion: 9,
    });
    expect(await prisma.user.count({ where: { id: gone.id } })).toBe(0); // deleted: the existing deletion behavior
    expect(await local(suspended.id)).toMatchObject({
      identityStatus: 'suspended',
    });
    expect(
      await prisma.session.count({ where: { userId: suspended.id } }),
    ).toBe(0);
    expect(
      (await prisma.identityReconcile.findUniqueOrThrow({ where: { id: 1 } }))
        .cursor,
    ).not.toBe('7');
    api.uniauth.feedState.gone = false;
  });

  it('a lagging directory is retried; a newer one stores its own version; a tombstone read deletes', async () => {
    const p = await person('Lag');
    // The event is for version 3 but the directory already shows version 5: that version is stored.
    api.uniauth.setIdentity(p.sub, { version: 5, name: 'Five' });
    expect((await send(p.sub, 'identity.updated', 3)).status).toBe(204);
    expect(await local(p.id)).toMatchObject({
      name: 'Five',
      identityVersion: 5,
    });
    // The event is for version 7 but the directory is still at 5: not yet consistent, so 503 and nothing recorded.
    const eventId = randomUUID();
    expect((await send(p.sub, 'identity.updated', 7, eventId)).status).toBe(
      503,
    );
    expect(
      await prisma.identityEventReceipt.count({ where: { eventId } }),
    ).toBe(0);
    api.uniauth.setIdentity(p.sub, { version: 7, name: 'Seven' });
    expect((await send(p.sub, 'identity.updated', 7, eventId)).status).toBe(
      204,
    );
    expect(await local(p.id)).toMatchObject({
      name: 'Seven',
      identityVersion: 7,
    });

    // The directory answers an update with a tombstone (the account was deleted meanwhile): the existing deletion.
    api.uniauth.setIdentity(p.sub, { version: 8, status: 'deleted' });
    expect((await send(p.sub, 'identity.updated', 8)).status).toBe(204);
    expect(await prisma.user.count({ where: { id: p.id } })).toBe(0);
  });

  it('two events for one person applied at the same moment never leave the older one in place', async () => {
    const { applyIdentityEvent } =
      await import('@/modules/uniauth/identity-events.service.js');
    for (let round = 0; round < 12; round++) {
      const p = await person('Race');
      const at = (version: number, name: string) => ({
        id: p.sub,
        name,
        email: p.profile.email,
        emailVerified: true,
        image: null,
        status: 'active' as const,
        version,
      });
      const ev = (version: number) => ({
        eventId: randomUUID(),
        type: 'identity.updated',
        subject: p.sub,
        identityVersion: version,
      });
      // Each event carries the profile as of its own version; the newer must win whichever runs first.
      await Promise.all([
        applyIdentityEvent(ev(5), { profile: at(5, 'Five'), userId: p.id }),
        applyIdentityEvent(ev(6), { profile: at(6, 'Six'), userId: p.id }),
      ]);
      expect(await local(p.id)).toMatchObject({
        name: 'Six',
        identityVersion: 6,
      });
    }
  });

  it('keeps the old email when another user holds the new one, and still applies the rest', async () => {
    const a = await person('Alpha');
    const b = await person('Beta');
    api.uniauth.setIdentity(a.sub, { version: 2, name: 'Alpha renamed' });
    // The directory now says Alpha's email is Beta's (a reconciliation case).
    await prisma.user.update({
      where: { id: a.id },
      data: { identityVersion: 1 },
    });
    api.uniauth.registerAccount({
      ...a.profile,
      email: b.profile.email,
      name: 'Alpha renamed',
    });
    expect((await send(a.sub, 'identity.updated', 2)).status).toBe(204);
    expect(await local(a.id)).toMatchObject({
      name: 'Alpha renamed',
      email: a.profile.email,
      identityVersion: 2,
    });
  });

  it('a bad feed entry or a missing profile is skipped and counted instead of wedging the cursor; a lagging directory stops', async () => {
    await prisma.identityReconcile.deleteMany({});
    api.uniauth.feed.length = 0;
    api.uniauth.feedState.gone = false;
    const good = await person('Good');
    // A local user linked to a uniAuth id the directory does not know (so its batch read says not_found).
    const orphan = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: 'Orphan',
        email: `orphan@${api.emailDomain}`,
      },
    });
    const orphanSub = `u_${randomUUID()}`;
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: orphanSub,
        providerId: 'uniauth',
        userId: orphan.id,
      },
    });
    api.uniauth.setIdentity(good.sub, { version: 2, name: 'Good updated' });
    api.uniauth.feed.push(
      {
        eventId: 'bad-1',
        type: 'identity.updated',
        id: 123 as unknown as string,
        version: 1,
      }, // malformed
      {
        eventId: 'missing-1',
        type: 'identity.updated',
        id: orphanSub,
        version: 1,
      }, // profile unreadable
      { eventId: 'ok-1', type: 'identity.updated', id: good.sub, version: 2 },
    );
    const result = await reconcileIdentities();
    expect(result).toEqual({
      applied: 1,
      resynced: false,
      skipped: 2,
      stopped: false,
    });
    expect(await local(good.id)).toMatchObject({ name: 'Good updated' });
    expect(
      (await prisma.identityReconcile.findUniqueOrThrow({ where: { id: 1 } }))
        .cursor,
    ).toBe('3'); // moved on

    // The directory is behind the feed: stop BEFORE the page, leave the cursor, retry next run.
    api.uniauth.feed.push({
      eventId: 'ahead-1',
      type: 'identity.updated',
      id: good.sub,
      version: 9,
    });
    const stopped = await reconcileIdentities();
    expect(stopped).toMatchObject({ applied: 0, stopped: true });
    expect(
      (await prisma.identityReconcile.findUniqueOrThrow({ where: { id: 1 } }))
        .cursor,
    ).toBe('3');
    api.uniauth.setIdentity(good.sub, { version: 9, name: 'Caught up' });
    expect(await reconcileIdentities()).toMatchObject({
      applied: 1,
      stopped: false,
    });
    expect(await local(good.id)).toMatchObject({
      name: 'Caught up',
      identityVersion: 9,
    });
    await prisma.user.deleteMany({ where: { id: orphan.id } });
  });

  it('prunes receipts older than 14 days when it reconciles', async () => {
    await prisma.identityEventReceipt.createMany({
      data: [
        {
          eventId: 'old-receipt',
          subject: 's',
          version: 1,
          type: 'identity.updated',
          receivedAt: new Date(Date.now() - 20 * 86_400_000),
        },
        {
          eventId: 'new-receipt',
          subject: 's',
          version: 1,
          type: 'identity.updated',
        },
      ],
    });
    api.uniauth.feed.length = 0;
    await prisma.identityReconcile.deleteMany({});
    await reconcileIdentities();
    expect(
      await prisma.identityEventReceipt.count({
        where: { eventId: 'old-receipt' },
      }),
    ).toBe(0);
    expect(
      await prisma.identityEventReceipt.count({
        where: { eventId: 'new-receipt' },
      }),
    ).toBe(1);
  });

  it('a Unishare-only verified account is added by email, then signs in to the same user and membership', async () => {
    // Created and verified in uniAuth through Unishare (its uniAuth id is its old Unishare user id), never in Uniloom.
    const unishareId = `unishare-user-${randomUUID()}`;
    const alice = api.newProfile({ name: 'Alice (Unishare)', sub: unishareId });
    api.uniauth.registerAccount(alice, { verified: true });
    expect(await prisma.user.count({ where: { email: alice.email } })).toBe(0);

    const owner = await api.signInReady();
    const created = await api.send('POST', '/api/projects', owner.cookie, {
      name: 'W',
      keyPrefix: freshPrefix(),
      mode: 'STANDARD',
    });
    const { id: projectId } = (await read(created)) as { id: string };
    const added = await api.send(
      'POST',
      `/api/projects/${projectId}/members`,
      owner.cookie,
      { email: alice.email, role: 'MEMBER' },
    );
    expect(added.status).toBe(201);
    const provisioned = await prisma.user.findUniqueOrThrow({
      where: { email: alice.email },
      include: { accounts: true },
    });
    expect(
      provisioned.accounts.map((x) => [x.providerId, x.accountId, x.password]),
    ).toEqual([['uniauth', unishareId, null]]);
    expect(provisioned.consentGivenAt).toBeNull();

    // She signs in to Uniloom for the first time: the same local user, her membership intact, shared acceptance supplied by UniAuth.
    const session = await api.signIn(alice);
    const me = (await read(
      await api.send('GET', '/api/me', session.cookie),
    )) as { id: string };
    expect(me.id).toBe(provisioned.id);
    expect(
      await prisma.member.count({
        where: { projectId, userId: provisioned.id },
      }),
    ).toBe(1);
    expect(await prisma.user.count({ where: { email: alice.email } })).toBe(1);
    expect(
      (await api.send('POST', '/api/users/me/consent', session.cookie)).status,
    ).toBe(200);
    expect(
      (await api.send('GET', `/api/projects/${projectId}`, session.cookie))
        .status,
    ).toBe(200);

    // And the identity contracts keep applying to her: an update from Unishare's side reaches the same user.
    api.uniauth.setIdentity(unishareId, { version: 4, name: 'Alice Renamed' });
    expect((await send(unishareId, 'identity.updated', 4)).status).toBe(204);
    expect((await local(provisioned.id)).name).toBe('Alice Renamed');
  });
});
