import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { HttpError } from '@/lib/server';
import { publicPost } from '@/modules/content/service';
import { normalizeTechnical } from './normalize';

const filtersSchema = z.object({
  q: z.string().max(200).default(''),
  scope: z.enum(['all', 'saved']).default('all'),
  topic: z.string().max(60).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  format: z.enum(['concept', 'tip', 'pitfall', 'code', 'history', 'comparison', 'carousel']).optional(),
  cursor: z.string().max(1200).optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
});

export async function searchPosts(userId: string, params: URLSearchParams) {
  const data = filtersSchema.parse(Object.fromEntries(params));
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ ...data, cursor: undefined, userId }))
    .digest('hex');
  let offset = 0;
  if (data.cursor) {
    try {
      const [body, sig] = data.cursor.split('.');
      const expected = createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(body).digest('base64url');
      if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
        throw new Error();
      const cursor = JSON.parse(Buffer.from(body, 'base64url').toString());
      if (cursor.f !== fingerprint || !Number.isSafeInteger(cursor.o) || cursor.o < 0 || cursor.o > 100000)
        throw new Error();
      offset = cursor.o;
    } catch {
      throw new HttpError(400, 'INVALID_CURSOR', 'Curseur de recherche invalide.');
    }
  }
  const term = data.q.trim();
  const normalized = normalizeTechnical(term);
  const trigram = !!(await pool.query("SELECT 1 FROM pg_extension WHERE extname='pg_trgm'")).rowCount;
  const values: unknown[] = [
    userId,
    term,
    normalized,
    data.scope,
    data.topic ?? null,
    data.difficulty ?? null,
    data.format ?? null,
    data.after ?? null,
    data.before ?? null,
    offset,
  ];
  // Separate candidate branches let PostgreSQL choose the relevant GIN index for
  // each predicate. Typo matching uses short descriptors; the body stays fully
  // searchable through FTS and normalized exact matching.
  const matching = term
    ? `matching AS MATERIALIZED (
    SELECT id FROM post_versions WHERE search_fr @@ websearch_to_tsquery('french',$2)
    UNION SELECT id FROM post_versions WHERE search_simple @@ websearch_to_tsquery('simple',$2)
    UNION SELECT id FROM post_versions WHERE $3<>'' AND search_normalized LIKE '%'||$3||'%'
    ${trigram ? 'UNION SELECT id FROM post_versions WHERE length($3)>=4 AND search_hints %> $3' : ''}
  ),`
    : '';
  const score = `CASE WHEN $2='' THEN 0 ELSE ts_rank_cd(v.search_fr,websearch_to_tsquery('french',$2))*2
    + ts_rank_cd(v.search_simple,websearch_to_tsquery('simple',$2))
    + CASE WHEN $3<>'' AND v.search_normalized LIKE '%'||$3||'%' THEN 2 ELSE 0 END END`;
  // Access, publication and saved-date filters precede both counting and pagination.
  // One materialized result and one SQL statement keep count and page consistent,
  // including an empty page whose offset is past the end of the result set.
  const sql = `WITH ${matching} candidates AS MATERIALIZED (
    SELECT p.id,p.status,p.slug,v.id version_id,v.version,v.content,v.published_at,s.saved_at,${score} score
    FROM posts p LEFT JOIN post_versions v ON v.id=p.current_published_version_id
    ${term ? 'JOIN matching m ON m.id=v.id' : ''}
    LEFT JOIN saved_posts s ON s.post_id=p.id AND s.user_id=$1
    WHERE ($4='saved' AND s.user_id=$1 OR $4='all' AND p.status='published')
    AND (p.status='published' OR ($4='saved' AND $2='' AND $5::text IS NULL AND $6::text IS NULL AND $7::text IS NULL))
    AND ($5::text IS NULL OR v.content->>'topic'=$5)
    AND ($6::text IS NULL OR v.content->>'difficulty'=$6)
    AND ($7::text IS NULL OR v.content->>'format'=$7)
    AND ($8::timestamptz IS NULL OR s.saved_at>=$8::timestamptz)
    AND ($9::timestamptz IS NULL OR s.saved_at<=$9::timestamptz)
  ) SELECT (SELECT count(*) FROM candidates)::int total,
    coalesce((SELECT json_agg(page) FROM (
      SELECT * FROM candidates ORDER BY score DESC,
        CASE WHEN $4='saved' THEN saved_at ELSE published_at END DESC NULLS LAST,id
      LIMIT 13 OFFSET $10
    ) page),'[]'::json) matches`;
  const found = (await pool.query(sql, values)).rows[0];
  const rows = found.matches as Record<string, unknown>[];
  const hasMore = rows.length > 12;
  const posts = rows.slice(0, 12).map((row) =>
    row.status === 'published'
      ? publicPost(row)
      : {
          id: String(row.id),
          slug: String(row.slug),
          title: 'Contenu indisponible',
          unavailable: true,
          saved: true,
          savedAt: row.saved_at as string | null,
        },
  );
  let nextCursor = null;
  if (hasMore) {
    const body = Buffer.from(JSON.stringify({ f: fingerprint, o: offset + 12 })).toString('base64url');
    nextCursor = `${body}.${createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(body).digest('base64url')}`;
  }
  return {
    posts,
    nextCursor,
    total: Number(found.total),
    searchMode: trigram ? 'lexical+trigram' : 'lexical',
  };
}
