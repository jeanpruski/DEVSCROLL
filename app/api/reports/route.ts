import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { api, readJson, HttpError } from '@/lib/server';
import { transaction } from '@/lib/db';
const schema = z.object({ postVersionId: z.string().uuid(), reason: z.string().min(5).max(2000) });
export const POST = api(
  async (req, user) => {
    const data = schema.parse(await readJson(req));
    return transaction(async (c) => {
      const p = (
        await c.query(
          "SELECT p.id FROM posts p WHERE p.current_published_version_id=$1 AND p.status='published'",
          [data.postVersionId],
        )
      ).rows[0];
      if (!p) throw new HttpError(404, 'NOT_FOUND', 'Version introuvable.');
      const id = randomUUID();
      await c.query('INSERT INTO content_reports(id,user_id,post_version_id,reason) VALUES($1,$2,$3,$4)', [
        id,
        user.id,
        data.postVersionId,
        data.reason,
      ]);
      return { id, status: 'open' };
    });
  },
  { mutation: true, rateLimit: 10 },
);
