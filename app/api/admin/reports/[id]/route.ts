import { z } from 'zod';
import { api, HttpError } from '@/lib/server';
import { transaction } from '@/lib/db';
import { audit } from '@/modules/content/service';
export const PUT = api(
  async (_req, user, ctx) =>
    transaction(async (c) => {
      const id = z
        .string()
        .uuid()
        .parse((await ctx.params).id);
      const r = await c.query("UPDATE content_reports SET status='resolved' WHERE id=$1 RETURNING id", [id]);
      if (!r.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Signalement introuvable.');
      await audit(c, user.id, 'report.resolve', id);
      return { id, status: 'resolved' };
    }),
  { owner: true, mutation: true },
);
