import { api } from '@/lib/server';
import { pool } from '@/lib/db';
export const GET = api(async (_req, user) => {
  const r = await pool.query(
    `SELECT ((SELECT count(*) FROM exposures WHERE user_id=$1 AND qualified)+(SELECT coalesce(sum(qualified_count),0) FROM exposure_rollups WHERE user_id=$1)) exposures,(SELECT count(*) FROM saved_posts WHERE user_id=$1) saved,(SELECT count(*) FROM question_attempts WHERE user_id=$1 AND action='answer') attempts,(SELECT count(*) FROM question_attempts WHERE user_id=$1 AND correct) correct,
 (SELECT count(*) FROM learning_states l WHERE l.user_id=$1 AND l.due_at<=now() AND NOT l.needs_revalidation
 AND (l.last_skipped_at IS NULL OR l.last_skipped_at<now()-interval '1 hour')
 AND EXISTS(SELECT 1 FROM question_versions q WHERE q.concept_key=l.concept_key AND q.status='active')
 AND EXISTS(SELECT 1 FROM posts p WHERE p.concept_key=l.concept_key AND p.status='published')) due`,
    [user.id],
  );
  const s = r.rows[0];
  return {
    stats: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v)])),
    preferences: (await pool.query('SELECT data FROM user_preferences WHERE user_id=$1', [user.id])).rows[0]
      ?.data,
  };
});
