import { z } from 'zod';
import { api, readJson, HttpError } from '@/lib/server';
import { pool } from '@/lib/db';
const schema = z.object({ postId: z.string().uuid(), kind: z.enum(['known', 'more', 'less', 'review']) });
export const POST = api(
  async (req, user) => {
    const data = schema.parse(await readJson(req));
    const p = (
      await pool.query("SELECT concept_key FROM posts WHERE id=$1 AND status='published'", [data.postId])
    ).rows[0];
    if (!p) throw new HttpError(404, 'NOT_FOUND', 'Post introuvable.');
    if (data.kind === 'review')
      await pool.query(
        'INSERT INTO learning_states(user_id,concept_key) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [user.id, p.concept_key],
      );
    else
      await pool.query(
        'INSERT INTO post_feedback(user_id,post_id,kind) VALUES($1,$2,$3) ON CONFLICT(user_id,post_id) DO UPDATE SET kind=EXCLUDED.kind,created_at=now()',
        [user.id, data.postId, data.kind],
      );
    return { ok: true };
  },
  { mutation: true },
);
