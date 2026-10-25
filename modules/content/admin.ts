import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { pool, transaction } from '@/lib/db';
import { HttpError } from '@/lib/server';
import { postSchema, questionSchema } from '@/lib/contracts';
import { audit, createPost, createQuestion, saveDraft } from './service';

export async function listPosts(params: URLSearchParams) {
  const status = z
    .enum(['idea', 'draft', 'review', 'published', 'archived'])
    .optional()
    .parse(params.get('status') ?? undefined);
  const rows = await pool.query(
    `SELECT p.id,p.slug,p.status,v.version,v.id "versionId",v.content->>'title' title,v.content->>'topic' topic,v.content->>'difficulty' difficulty,v.content->>'format' format,p.updated_at "updatedAt",(p.current_published_version_id IS NOT NULL AND p.current_published_version_id<>p.latest_version_id) "hasDraft" FROM posts p JOIN post_versions v ON v.id=p.latest_version_id WHERE ($1::text IS NULL OR p.status=$1) ORDER BY p.updated_at DESC,p.id LIMIT 500`,
    [status ?? null],
  );
  return { posts: rows.rows };
}
export async function adminPost(id: string, version?: number) {
  z.string().uuid().parse(id);
  z.number().int().positive().max(2147483647).optional().parse(version);
  const row = (
    await pool.query(
      `SELECT p.*,v.content,v.id version_id,v.version,v.created_at version_created_at,v.published_at version_published_at
    FROM posts p JOIN post_versions v ON v.post_id=p.id AND (($2::integer IS NULL AND v.id=p.latest_version_id) OR v.version=$2)
    WHERE p.id=$1`,
      [id, version ?? null],
    )
  ).rows[0];
  if (!row)
    throw new HttpError(
      404,
      'NOT_FOUND',
      version === undefined ? 'Post introuvable.' : 'Version de ce post introuvable.',
    );
  const versions = (
    await pool.query(
      `SELECT v.id,v.version,v.created_at "createdAt",v.published_at "publishedAt",
    v.id=p.latest_version_id "isLatest",v.id=p.current_published_version_id "isPublished"
    FROM post_versions v JOIN posts p ON p.id=v.post_id WHERE v.post_id=$1 ORDER BY v.version DESC`,
      [id],
    )
  ).rows;
  const questions = (
    await pool.query(
      'SELECT id,concept_key "conceptKey",version,prompt,choices,correct_choice_id "correctChoiceId",explanation,status FROM question_versions WHERE concept_key=$1 ORDER BY version DESC',
      [row.content.conceptKey],
    )
  ).rows;
  const latestVersion = row.version_id === row.latest_version_id;
  return {
    post: {
      ...row.content,
      id: row.id,
      versionId: row.version_id,
      version: row.version,
      publicationStatus: row.status,
      latestVersion,
      readOnly: !latestVersion,
      createdAt: row.version_created_at,
      publishedAt: row.version_published_at,
    },
    versions,
    questions,
  };
}
export const importSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  posts: postSchema.array().max(100),
  questions: questionSchema.array().max(100).optional(),
});
export async function importPosts(input: unknown, actorId: string) {
  const parsed = Array.isArray(input) ? { posts: input } : input;
  const data = importSchema.parse(parsed);
  return transaction(async (c) => {
    const imported: string[] = [];
    const skipped: string[] = [];
    for (const content of data.posts) {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`import:${content.slug}`]);
      if ((await c.query('SELECT id FROM posts WHERE slug=$1', [content.slug])).rowCount) {
        skipped.push(content.slug);
        continue;
      }
      // Imports always enter the editorial review flow as drafts.
      const post = await createPost({ ...content, status: 'draft' }, actorId, c);
      imported.push(post.id);
    }
    for (const question of data.questions ?? []) {
      if (!(await c.query('SELECT key FROM concepts WHERE key=$1', [question.conceptKey])).rowCount) continue;
      const existing = (
        await c.query(
          "SELECT id FROM question_versions WHERE concept_key=$1 AND prompt=$2 AND status='active'",
          [question.conceptKey, question.prompt],
        )
      ).rowCount;
      if (!existing) await createQuestion(question, actorId, c);
    }
    await audit(c, actorId, 'content.import', randomUUID(), {
      imported: imported.length,
      skipped: skipped.length,
    });
    return { imported, skipped };
  });
}
export async function duplicatePost(id: string, actorId: string) {
  const row = await adminPost(id);
  return createPost(
    {
      ...row.post,
      slug: `${row.post.slug.slice(0, 140)}-${randomUUID().slice(0, 8)}`,
      title: `${row.post.title.slice(0, 170)} (copie)`,
      status: 'draft',
    },
    actorId,
  );
}
export async function exportContent() {
  const posts = (
    await pool.query(
      'SELECT v.content,p.status FROM posts p JOIN post_versions v ON v.id=p.latest_version_id ORDER BY p.slug',
    )
  ).rows.map((r) => ({ ...r.content, status: r.status }));
  const questions = (
    await pool.query(
      'SELECT concept_key "conceptKey",prompt,choices,correct_choice_id "correctChoiceId",explanation FROM question_versions WHERE status=\'active\' ORDER BY concept_key',
    )
  ).rows;
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), posts, questions };
}
export async function quality() {
  const reports = (
    await pool.query(
      'SELECT r.id,r.reason,r.status,r.created_at "createdAt",r.post_version_id "postVersionId",v.post_id "postId",v.content->>\'title\' title FROM content_reports r JOIN post_versions v ON v.id=r.post_version_id ORDER BY r.created_at DESC LIMIT 200',
    )
  ).rows;
  const stale = (
    await pool.query(
      `SELECT p.id,p.slug,v.content->>'title' title,v.content->>'topic' topic,v.published_at "publishedAt",v.content->'flags' flags FROM posts p JOIN post_versions v ON v.id=p.current_published_version_id WHERE p.status='published' AND (v.published_at+((v.content->>'reviewAfterDays')::integer*interval '1 day')<now() OR v.content->'flags' ?| ARRAY['stale','reported'] OR EXISTS(SELECT 1 FROM content_reports r WHERE r.post_version_id=v.id AND r.status='open')) ORDER BY v.published_at LIMIT 200`,
    )
  ).rows;
  const diagnostics = (
    await pool.query(`SELECT now() "serverTime",
    (SELECT count(*) FROM posts WHERE status='published') "publishedPosts",
    (SELECT count(*) FROM posts WHERE status IN ('idea','draft','review')) "draftPosts",
    (SELECT count(*) FROM question_versions WHERE status='active') "activeQuestions",
    (SELECT count(*) FROM content_reports WHERE status='open') "openReports",
    (SELECT count(*) FROM learning_states WHERE needs_revalidation) "pendingRevalidations",
    (SELECT count(*) FROM exposures) "detailedExposures",
    (SELECT coalesce(sum(qualified_count),0) FROM exposure_rollups) "archivedQualifiedExposures",
    (SELECT count(*) FROM exposures WHERE created_at<now()-interval '90 days') "exposuresAwaitingRetention",
    (SELECT count(*) FROM generation_jobs WHERE state='queued') "queuedJobs",
    (SELECT count(*) FROM generation_jobs WHERE state='processing' AND locked_until>=now()) "activeJobLeases",
    (SELECT count(*) FROM generation_jobs WHERE state='processing' AND locked_until<now()) "expiredJobLeases",
    (SELECT count(*) FROM generation_jobs WHERE state='failed') "failedJobs",
    (SELECT count(*) FROM generation_jobs WHERE cost_state='unknown') "unknownCostJobs",
    (SELECT coalesce(sum(spent_cents),0) FROM generation_budgets WHERE month=date_trunc('month',now() AT TIME ZONE 'UTC')::date) "monthEstimatedSpentCents",
    (SELECT coalesce(sum(reserved_cents),0) FROM generation_budgets WHERE month=date_trunc('month',now() AT TIME ZONE 'UTC')::date) "monthReservedCents",
    (SELECT max(applied_at) FROM schema_migrations) "lastMigrationAt",
    EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_trgm') "trigramEnabled"`)
  ).rows[0];
  return { reports, stale, diagnostics };
}
export { saveDraft };
