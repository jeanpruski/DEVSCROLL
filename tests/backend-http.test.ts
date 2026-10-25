import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { pool } from '../lib/db';

// Run explicitly against a running local server: HTTP_TEST_URL=http://localhost:3000 npm test -- tests/backend-http.test.ts
describe.skipIf(!process.env.HTTP_TEST_URL)('private HTTP API', () => {
  const base = process.env.HTTP_TEST_URL!;
  const readerId = randomUUID(),
    email = `http-${randomUUID()}@test.invalid`,
    password = randomUUID();
  let readerCookie: string, ownerCookie: string;
  async function login(loginEmail: string, loginPassword: string) {
    const r = await fetch(`${base}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    expect(r.status).toBe(200);
    return r.headers
      .getSetCookie()
      .map((s) => s.split(';')[0])
      .join('; ');
  }
  beforeAll(async () => {
    if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
      throw new Error('HTTP security tests require a local server.');
    await pool.query("INSERT INTO \"user\"(id,name,email,role) VALUES($1,'HTTP reader',$2,'reader')", [
      readerId,
      email,
    ]);
    await pool.query(
      'INSERT INTO account(id,"accountId","providerId","userId",password) VALUES($1,$2,\'credential\',$2,$3)',
      [randomUUID(), readerId, await hashPassword(password)],
    );
    readerCookie = await login(email, password);
    ownerCookie = await login(process.env.OWNER_EMAIL!, process.env.OWNER_PASSWORD!);
  });
  afterAll(async () => {
    await pool.query('DELETE FROM "user" WHERE id=$1', [readerId]);
    await pool.end();
  });
  it('requires authentication for private data and administration', async () => {
    for (const route of [
      '/api/feed',
      '/api/search',
      '/api/admin/posts',
      '/api/admin/generation-runs',
      '/api/export',
    ])
      expect((await fetch(`${base}${route}`)).status).toBe(401);
  });
  it('keeps public signup disabled', async () => {
    const signupEmail = `signup-${randomUUID()}@test.invalid`;
    const r = await fetch(`${base}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Blocked signup', email: signupEmail, password: randomUUID() }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect((await pool.query('SELECT id FROM "user" WHERE email=$1', [signupEmail])).rowCount).toBe(0);
  });
  it('denies reader administration and owner mutations from another origin', async () => {
    for (const route of [
      '/api/admin/posts',
      '/api/admin/quality',
      '/api/admin/questions',
      '/api/admin/export',
      '/api/admin/generation-runs',
    ])
      expect((await fetch(`${base}${route}`, { headers: { Cookie: readerCookie } })).status).toBe(403);
    const r = await fetch(`${base}/api/preferences`, {
      method: 'PUT',
      headers: { Cookie: ownerCookie, Origin: 'https://foreign.invalid', 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(r.status).toBe(403);
  });
  it('binds feed cursors and exposures to the authenticated user', async () => {
    const response = await fetch(`${base}/api/feed`, { headers: { Cookie: readerCookie } });
    expect(response.status).toBe(200);
    const feed = await response.json();
    expect(feed.posts.length).toBeGreaterThan(0);
    const cross = await fetch(`${base}/api/feed?cursor=${encodeURIComponent(feed.nextCursor)}`, {
      headers: { Cookie: ownerCookie },
    });
    expect(cross.status).toBe(400);
    const exposure = await fetch(`${base}/api/exposures`, {
      method: 'POST',
      headers: { Cookie: ownerCookie, Origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: feed.sessionId,
        postId: feed.posts[0].id,
        eventId: randomUUID(),
        visibleMs: 6000,
        ratio: 0.8,
      }),
    });
    expect(exposure.status).toBe(404);
  });
  it('invalidates a persistent session on logout', async () => {
    const result = await fetch(`${base}/api/auth/sign-out`, {
      method: 'POST',
      headers: { Cookie: readerCookie, Origin: base, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(result.status).toBe(200);
    expect((await fetch(`${base}/api/profile`, { headers: { Cookie: readerCookie } })).status).toBe(401);
  });
});
