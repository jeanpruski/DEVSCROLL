import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeTechnical } from '../modules/search/normalize';
import { rankCandidates, type Candidate } from '../modules/feed/rank';
import { api } from '../lib/server';

const authMock = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('../lib/auth', () => ({ getUser: authMock.getUser }));

describe('technical search normalization', () => {
  it('preserves punctuation-sensitive identifiers and accents', () => {
    expect(normalizeTechnical('C++ C# .env Promise.all CI/CD Node.js Réessayer')).toBe(
      'cpp csharp dotenv promiseall cicd nodejs reessayer',
    );
  });
});
describe('server authorization', () => {
  beforeEach(() => {
    authMock.getUser.mockReset();
  });
  it('requires login before running an action', async () => {
    authMock.getUser.mockResolvedValue(null);
    const handler = vi.fn();
    const response = await api(handler, { owner: true })(
      new Request('http://localhost:3000/api/admin/posts'),
    );
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
  it('checks the owner role on the server', async () => {
    authMock.getUser.mockResolvedValue({ id: 'reader', role: 'reader' });
    const handler = vi.fn();
    expect(
      (await api(handler, { owner: true })(new Request('http://localhost:3000/api/admin/posts'))).status,
    ).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it('rejects a cross-origin mutation and permits the expected origin', async () => {
    authMock.getUser.mockResolvedValue({ id: 'owner', role: 'owner' });
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const origin = process.env.BETTER_AUTH_URL
      ? new URL(process.env.BETTER_AUTH_URL).origin
      : 'http://localhost:3000';
    const route = api(handler, { owner: true, mutation: true });
    expect(
      (
        await route(
          new Request(`${origin}/api/admin/posts`, {
            method: 'POST',
            headers: { Origin: 'https://foreign.invalid' },
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await route(new Request(`${origin}/api/admin/posts`, { method: 'POST', headers: { Origin: origin } })))
        .status,
    ).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
describe('deterministic feed', () => {
  const posts: Candidate[] = Array.from({ length: 18 }, (_, i) => ({
    id: String(i),
    topic: i % 3 === 0 ? 'sql' : i % 3 === 1 ? 'javascript' : 'culture',
    conceptKey: `concept-${i}`,
    difficulty: 'intermediate',
  }));
  it('ranks a stable snapshot without duplicates and with discovery slots', () => {
    const order = rankCandidates(
      posts,
      { topics: ['javascript', 'sql'], difficulty: 'intermediate' },
      'seed',
    );
    expect(order).toEqual(
      rankCandidates(posts, { topics: ['javascript', 'sql'], difficulty: 'intermediate' }, 'seed'),
    );
    expect(new Set(order).size).toBe(posts.length);
    expect(posts.find((p) => p.id === order[4])?.topic).toBe('culture');
    for (let i = 2; i < order.length; i++) {
      const topics = order.slice(i - 2, i + 1).map((id) => posts.find((p) => p.id === id)!.topic);
      if (i < 15) expect(new Set(topics).size).toBeGreaterThan(1);
    }
  });
  it('supports a one-item corpus without looping or losing the item', () => {
    expect(rankCandidates(posts.slice(0, 1), { topics: ['sql'] }, 'small')).toEqual(['0']);
  });
});
