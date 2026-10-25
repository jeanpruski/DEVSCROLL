import { randomUUID } from 'node:crypto';
import {
  postSchema,
  questionSchema,
  type PostContent,
  type PublicPost,
  type PublicQuestion,
} from '@/lib/contracts';
import { pool, transaction, type Db } from '@/lib/db';
import { HttpError } from '@/lib/server';
import { normalizeTechnical } from '@/modules/search/normalize';
import { choiceOrder } from '@/modules/reviews/order';

export function searchableText(content: PostContent) {
  const title = [
    content.title,
    content.topic,
    content.context.technology,
    content.context.version ?? '',
    ...content.tags,
    ...content.searchAliases,
    content.conceptKey,
  ].join(' ');
  const body = [
    content.learningObjective,
    content.takeaway,
    ...content.blocks.map((b) =>
      b.type === 'paragraph'
        ? b.text
        : b.type === 'code'
          ? b.code
          : b.type === 'list'
            ? b.items.join(' ')
            : b.type === 'comparison'
              ? `${b.leftLabel} ${b.left} ${b.rightLabel} ${b.right}`
              : b.alt,
    ),
  ].join(' ');
  return { title, body, normalized: normalizeTechnical(`${title} ${body}`) };
}
export async function audit(
  client: Db,
  actorId: string | null,
  action: string,
  targetId: string,
  metadata: object = {},
) {
  await client.query('INSERT INTO audit_log(id,actor_id,action,target_id,metadata) VALUES($1,$2,$3,$4,$5)', [
    randomUUID(),
    actorId,
    action,
    targetId,
    JSON.stringify(metadata),
  ]);
}
async function insertVersion(
  c: Db,
  postId: string,
  content: PostContent,
  version: number,
  actorId: string | null,
) {
  const id = randomUUID();
  const text = searchableText(content);
  await c.query(
    `INSERT INTO post_versions(id,post_id,version,content,search_fr,search_simple,search_normalized,author_id)
    VALUES($1,$2,$3,$4,setweight(to_tsvector('french',$5),'A')||setweight(to_tsvector('french',$6),'B'),setweight(to_tsvector('simple',$5),'A')||setweight(to_tsvector('simple',$6),'B'),$7,$8)`,
    [id, postId, version, JSON.stringify(content), text.title, text.body, text.normalized, actorId],
  );
  await c.query('UPDATE posts SET latest_version_id=$2,updated_at=now() WHERE id=$1', [postId, id]);
  return { id: postId, versionId: id, version, content };
}
export async function createPost(
  input: unknown,
  actorId: string | null,
  client?: Db,
): Promise<{ id: string; versionId: string; version: number; content: PostContent }> {
  const content = postSchema.parse(input);
  content.status = content.status === 'idea' ? 'idea' : 'draft';
  const run = async (c: Db) => {
    await c.query('INSERT INTO concepts(key,objective) VALUES($1,$2) ON CONFLICT(key) DO NOTHING', [
      content.conceptKey,
      content.learningObjective,
    ]);
    const id = randomUUID();
    await c.query('INSERT INTO posts(id,slug,status,concept_key) VALUES($1,$2,$3,$4)', [
      id,
      content.slug,
      content.status,
      content.conceptKey,
    ]);
    const result = await insertVersion(c, id, content, 1, actorId);
    await audit(c, actorId, 'post.create', id);
    return result;
  };
  return client ? run(client) : transaction(run);
}
export async function saveDraft(postId: string, input: unknown, actorId: string | null, client?: Db) {
  const content = postSchema.parse(input);
  if (content.status === 'published') content.status = 'draft';
  const run = async (c: Db) => {
    const found = await c.query('SELECT * FROM posts WHERE id=$1 FOR UPDATE', [postId]);
    const post = found.rows[0];
    if (!post) throw new HttpError(404, 'NOT_FOUND', 'Post introuvable.');
    await c.query('INSERT INTO concepts(key,objective) VALUES($1,$2) ON CONFLICT(key) DO NOTHING', [
      content.conceptKey,
      content.learningObjective,
    ]);
    // Public concept and slug remain tied to the live revision until publication.
    const version = (
      await c.query('SELECT coalesce(max(version),0)+1 AS n FROM post_versions WHERE post_id=$1', [postId])
    ).rows[0].n;
    const result = await insertVersion(c, postId, content, Number(version), actorId);
    if (!post.current_published_version_id)
      await c.query('UPDATE posts SET slug=$2,concept_key=$3,status=$4 WHERE id=$1', [
        postId,
        content.slug,
        content.conceptKey,
        content.status,
      ]);
    await audit(c, actorId, 'post.revise', postId, { version: Number(version) });
    return result;
  };
  return client ? run(client) : transaction(run);
}
export async function publishPost(postId: string, actorId: string | null) {
  return transaction(async (c) => {
    const found = await c.query(
      'SELECT p.*,v.content FROM posts p JOIN post_versions v ON v.id=p.latest_version_id WHERE p.id=$1 FOR UPDATE OF p',
      [postId],
    );
    const row = found.rows[0];
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Post introuvable.');
    const content = postSchema.parse(row.content);
    if (
      !content.sources.length ||
      content.flags.some((f) => ['needs_sources', 'code_unverified'].includes(f))
    )
      throw new HttpError(
        422,
        'PUBLICATION_BLOCKED',
        'Ajoute des sources et lève les vérifications bloquantes avant publication.',
      );
    await c.query(
      "UPDATE posts SET status='published',slug=$2,concept_key=$3,current_published_version_id=latest_version_id,updated_at=now() WHERE id=$1",
      [postId, content.slug, content.conceptKey],
    );
    await c.query('UPDATE post_versions SET published_at=coalesce(published_at,now()) WHERE id=$1', [
      row.latest_version_id,
    ]);
    await audit(c, actorId, 'post.publish', postId, { versionId: row.latest_version_id });
    return { id: postId, published: true };
  });
}
export async function changeStatus(postId: string, action: 'unpublish' | 'archive', actorId: string) {
  return transaction(async (c) => {
    const found = await c.query(
      'UPDATE posts SET status=$2,current_published_version_id=NULL,updated_at=now() WHERE id=$1 RETURNING id,concept_key',
      [postId, action === 'archive' ? 'archived' : 'draft'],
    );
    if (!found.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Post introuvable.');
    await audit(c, actorId, `post.${action}`, postId);
    return { id: postId, status: action === 'archive' ? 'archived' : 'draft' };
  });
}
export function publicPost(row: Record<string, unknown>): PublicPost {
  const content = postSchema.parse(row.content);
  return {
    ...content,
    status: 'published',
    id: String(row.id),
    versionId: String(row.version_id),
    version: Number(row.version),
    saved: !!row.saved_at,
    savedAt: row.saved_at instanceof Date ? row.saved_at.toISOString() : (row.saved_at as string | null),
    publishedAt:
      row.published_at instanceof Date ? row.published_at.toISOString() : (row.published_at as string),
  };
}
export function publicQuestion(row: Record<string, unknown>, order?: string[]): PublicQuestion {
  const choices = row.choices as { id: string; text: string }[];
  return {
    id: String(row.id),
    conceptKey: String(row.concept_key),
    prompt: String(row.prompt),
    choices: order ? order.map((id) => choices.find((c) => c.id === id)!).filter(Boolean) : choices,
    postSlug: row.post_slug as string | undefined,
  };
}
export async function getPost(slug: string, userId: string) {
  const found = await pool.query(
    `SELECT p.id,v.id version_id,v.version,v.content,v.published_at,s.saved_at FROM posts p JOIN post_versions v ON v.id=p.current_published_version_id LEFT JOIN saved_posts s ON s.post_id=p.id AND s.user_id=$2 WHERE p.slug=$1 AND p.status='published'`,
    [slug, userId],
  );
  if (!found.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Post introuvable ou retiré.');
  const post = publicPost(found.rows[0]);
  const q = await pool.query(
    `SELECT * FROM question_versions WHERE concept_key=$1 AND status='active' ORDER BY version DESC LIMIT 1`,
    [post.conceptKey],
  );
  return {
    post,
    question: q.rowCount
      ? {
          ...publicQuestion(q.rows[0], choiceOrder(q.rows[0].choices, `${q.rows[0].id}:${userId}`)),
          mode: 'immediate' as const,
        }
      : undefined,
  };
}
export async function savePost(userId: string, postId: string) {
  return transaction(async (c) => {
    const p = await c.query(
      `SELECT p.concept_key FROM posts p WHERE p.id=$1 AND p.status='published' AND p.current_published_version_id IS NOT NULL FOR SHARE`,
      [postId],
    );
    if (!p.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Post introuvable ou retiré.');
    await c.query('INSERT INTO saved_posts(user_id,post_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [
      userId,
      postId,
    ]);
    await c.query('INSERT INTO user_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING', [userId]);
    const prefs = (await c.query('SELECT data FROM user_preferences WHERE user_id=$1', [userId])).rows[0]
      .data;
    if (prefs.reviewsEnabled !== false)
      await c.query('INSERT INTO learning_states(user_id,concept_key) VALUES($1,$2) ON CONFLICT DO NOTHING', [
        userId,
        p.rows[0].concept_key,
      ]);
    return { saved: true };
  });
}
export async function createQuestion(input: unknown, actorId: string | null, client?: Db) {
  const content = questionSchema.parse(input);
  const run = async (c: Db) => {
    await c.query('SELECT key FROM concepts WHERE key=$1 FOR UPDATE', [content.conceptKey]);
    const current = await c.query(
      'SELECT coalesce(max(version),0)+1 n FROM question_versions WHERE concept_key=$1',
      [content.conceptKey],
    );
    const id = randomUUID();
    // A correction suspends earlier versions; attempts keep their immutable question reference.
    const previous = await c.query(
      `UPDATE question_versions SET status='withdrawn' WHERE concept_key=$1 AND status='active' RETURNING id`,
      [content.conceptKey],
    );
    if (previous.rowCount)
      await c.query('UPDATE learning_states SET needs_revalidation=true WHERE concept_key=$1', [
        content.conceptKey,
      ]);
    await c.query(
      'INSERT INTO question_versions(id,concept_key,version,prompt,choices,correct_choice_id,explanation) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        id,
        content.conceptKey,
        Number(current.rows[0].n),
        content.prompt,
        JSON.stringify(content.choices),
        content.correctChoiceId,
        content.explanation,
      ],
    );
    await audit(c, actorId, 'question.create', id, { conceptKey: content.conceptKey });
    return { id, ...content, version: Number(current.rows[0].n), status: 'active' };
  };
  return client ? run(client) : transaction(run);
}
