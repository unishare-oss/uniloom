import { toActivity } from './item.utils.js';

const row = {
  id: '0196b6a0-0000-7000-8000-000000000001',
  userId: 'u_1',
  clientId: null,
  agentName: null,
  action: 'item.move',
  projectId: '0196b6a0-0000-7000-8000-000000000002',
  itemId: '0196b6a0-0000-7000-8000-000000000003',
  detail: { from: 'Ready', to: 'In Progress' },
  createdAt: new Date('2026-10-11T10:00:00.000Z'),
  user: { name: 'Slade', image: null },
};

describe('toActivity', () => {
  it('maps a change made by a person: no agent', () => {
    expect(toActivity(row)).toEqual({
      id: row.id,
      action: 'item.move',
      detail: { from: 'Ready', to: 'In Progress' },
      by: { name: 'Slade', image: null },
      agent: null,
      at: '2026-10-11T10:00:00.000Z',
    });
  });

  it("names the agent's client", () => {
    const mapped = toActivity({
      ...row,
      clientId: 'claude-code',
      agentName: 'Claude Code',
    });
    expect(mapped.agent).toEqual({ name: 'Claude Code' });
  });

  it('keeps an agent without a name, and a person who is gone', () => {
    const mapped = toActivity({
      ...row,
      userId: null,
      user: null,
      clientId: 'claude-code',
    });
    expect(mapped.agent).toEqual({ name: null });
    expect(mapped.by).toEqual({ name: null, image: null });
  });
});
