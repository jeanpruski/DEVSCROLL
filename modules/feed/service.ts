import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { transaction } from '@/lib/db';
import { feedConfig } from '@/lib/config';
import { HttpError } from '@/lib/server';
import { publicPost } from '@/modules/content/service';
import { feedQuestion } from '@/modules/reviews/service';
import { rankCandidates } from './rank';
import type { PublicPost } from '@/lib/contracts';

function signature(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET requis');
  return createHmac('sha256', secret).update(value).digest('base64url');
}
export function encodeCursor(sessionId: string, position: number, userId: string) {
  const body = Buffer.from(JSON.stringify({ s: sessionId, p: position, u: userId })).toString('base64url');
  return `${body}.${signature(body)}`;
}
export function decodeCursor(value: string, userId: string): { s: string; p: number; u: string } {
  try {
    if (value.length > 1000) throw new Error();
    const [body, sig] = value.split('.');
    const actual = signature(body);
    if (!sig || actual.length !== sig.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(sig)))
      throw new Error();
    const parsed = z
      .object({ s: z.string().uuid(), p: z.number().int().min(0).max(100000), u: z.string() })
      .parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
    if (parsed.u !== userId) throw new Error();
    return parsed;
  } catch {
    throw new HttpError(400, 'INVALID_CURSOR', 'Curseur invalide.');
  }
}
export async function getFeed(
  userId: string,
  cursor?: string | null,
  replay = false,
  sessionId?: string | null,
) {
  const decoded = cursor
    ? decodeCursor(cursor, userId)
    : sessionId && !replay
      ? decodeCursor(encodeCursor(z.string().uuid().parse(sessionId), 0, userId), userId)
      : null;
  const page = await transaction(async (c) => {
    // Concurrent first requests reuse the same snapshot.
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`feed:${userId}`]);
    let session;
    if (decoded) {
      session = (
        await c.query(
          `SELECT * FROM feed_sessions WHERE id=$1 AND user_id=$2 AND last_active_at>now()-interval '30 minutes' FOR UPDATE`,
          [decoded.s, userId],
        )
      ).rows[0];
      if (!session) throw new HttpError(410, 'SESSION_EXPIRED', 'Cette session a expiré. Recharge le fil.');
    } else if (!replay)
      session = (
        await c.query(
          `SELECT * FROM feed_sessions WHERE user_id=$1 AND last_active_at>now()-interval '30 minutes' ORDER BY last_active_at DESC LIMIT 1 FOR UPDATE`,
          [userId],
        )
      ).rows[0];
    if (!session) {
      const prefs =
        (await c.query('SELECT data FROM user_preferences WHERE user_id=$1', [userId])).rows[0]?.data ?? {};
      const candidates = (
        await c.query(
          `SELECT p.id,v.content->>'topic' topic,v.content->>'difficulty' difficulty,p.concept_key "conceptKey",f.kind feedback,(s.user_id IS NOT NULL) saved FROM posts p JOIN post_versions v ON v.id=p.current_published_version_id
        LEFT JOIN post_feedback f ON f.post_id=p.id AND f.user_id=$1 LEFT JOIN saved_posts s ON s.post_id=p.id AND s.user_id=$1
        WHERE p.status='published' AND ($2::boolean OR NOT EXISTS(SELECT 1 FROM exposures e JOIN posts ep ON ep.id=e.post_id WHERE e.user_id=$1 AND e.qualified AND e.created_at>now()-interval '7 days' AND (e.post_id=p.id OR ep.concept_key=p.concept_key))) LIMIT 10000`,
          [userId, replay],
        )
      ).rows;
      const id = randomUUID(),
        seed = randomUUID();
      const ids = rankCandidates(candidates, prefs, seed);
      session = (
        await c.query(
          'INSERT INTO feed_sessions(id,user_id,seed,ranking_version,post_ids) VALUES($1,$2,$3,$4,$5) RETURNING *',
          [id, userId, seed, feedConfig.version, ids],
        )
      ).rows[0];
    }
    const start = decoded?.p ?? 0;
    if (start > session.post_ids.length) throw new HttpError(400, 'INVALID_CURSOR', 'Curseur invalide.');
    // A removed item never leaks from an old snapshot. Consume positions until six visible posts remain.
    let end = start;
    const posts: PublicPost[] = [];
    while (posts.length < feedConfig.pageSize && end < session.post_ids.length) {
      const ids = session.post_ids.slice(end, end + feedConfig.pageSize - posts.length);
      end += ids.length;
      const found = await c.query(
        `SELECT p.id,v.id version_id,v.version,v.content,v.published_at,s.saved_at FROM unnest($1::uuid[]) WITH ORDINALITY o(id,position) JOIN posts p ON p.id=o.id AND p.status='published' JOIN post_versions v ON v.id=p.current_published_version_id LEFT JOIN saved_posts s ON s.post_id=p.id AND s.user_id=$2 ORDER BY o.position`,
        [ids, userId],
      );
      posts.push(...found.rows.map(publicPost));
    }
    await c.query(
      'UPDATE feed_sessions SET last_active_at=now(),served_count=greatest(served_count,$2) WHERE id=$1',
      [session.id, end],
    );
    const exhausted = end >= session.post_ids.length;
    return {
      posts,
      sessionId: session.id,
      nextCursor: exhausted ? null : encodeCursor(session.id, end, userId),
      exhausted,
      rankingVersion: session.ranking_version,
    };
  });
  return { ...page, question: await feedQuestion(userId, page.sessionId) };
}
export const exposureSchema = z.object({
  sessionId: z.string().uuid(),
  postId: z.string().uuid(),
  eventId: z.string().uuid(),
  visibleMs: z.number().int().min(0).max(86_400_000),
  ratio: z.number().min(0).max(1),
  slides: z.array(z.number().int().min(0).max(19)).max(20).default([]),
});
export async function recordExposure(userId: string, input: unknown) {
  const data = exposureSchema.parse(input);
  const result = await transaction(async (c) => {
    const s = (
      await c.query(
        `SELECT * FROM feed_sessions WHERE id=$1 AND user_id=$2 AND last_active_at>now()-interval '30 minutes' FOR UPDATE`,
        [data.sessionId, userId],
      )
    ).rows[0];
    if (!s || !s.post_ids.slice(0, s.served_count).includes(data.postId))
      throw new HttpError(404, 'NOT_FOUND', 'Session ou post servi introuvable.');
    const q = data.visibleMs >= feedConfig.qualifiedMs && data.ratio >= feedConfig.qualifiedRatio;
    const sameEvent = (
      await c.query('SELECT post_id,session_id FROM exposures WHERE user_id=$1 AND event_id=$2', [
        userId,
        data.eventId,
      ])
    ).rows[0];
    if (sameEvent && (sameEvent.post_id !== data.postId || sameEvent.session_id !== data.sessionId))
      throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Événement déjà utilisé.');
    // Client sends cumulative visibleMs; max avoids double counting a retried event.
    await c.query(
      `INSERT INTO exposures(id,user_id,post_id,session_id,event_id,visible_ms,ratio,qualified,slides) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(user_id,session_id,post_id) DO UPDATE SET visible_ms=greatest(exposures.visible_ms,EXCLUDED.visible_ms),ratio=greatest(exposures.ratio,EXCLUDED.ratio),qualified=exposures.qualified OR EXCLUDED.qualified,slides=(SELECT coalesce(jsonb_agg(DISTINCT value),'[]'::jsonb) FROM jsonb_array_elements(exposures.slides||EXCLUDED.slides))`,
      [
        randomUUID(),
        userId,
        data.postId,
        data.sessionId,
        data.eventId,
        data.visibleMs,
        data.ratio,
        q,
        JSON.stringify(data.slides),
      ],
    );
    await c.query('UPDATE feed_sessions SET last_active_at=now() WHERE id=$1', [data.sessionId]);
    const qualifiedCount = Number(
      (
        await c.query('SELECT count(*) n FROM exposures WHERE user_id=$1 AND session_id=$2 AND qualified', [
          userId,
          data.sessionId,
        ])
      ).rows[0].n,
    );
    return { qualified: q, qualifiedCount };
  });
  return { ...result, question: await feedQuestion(userId, data.sessionId) };
}
