import { z } from 'zod';
import { api, readJson, HttpError } from '@/lib/server';
import { pool, transaction } from '@/lib/db';
import { audit, createQuestion } from '@/modules/content/service';
import { questionSchema } from '@/lib/contracts';
export const PUT = api(
  async (req, user, ctx) => {
    const id = z
      .string()
      .uuid()
      .parse((await ctx.params).id);
    const old = (await pool.query('SELECT concept_key FROM question_versions WHERE id=$1', [id])).rows[0];
    if (!old) throw new HttpError(404, 'NOT_FOUND', 'Question introuvable.');
    const content = questionSchema.parse(await readJson(req));
    if (content.conceptKey !== old.concept_key)
      throw new HttpError(422, 'CONCEPT_MISMATCH', 'Une correction conserve la notion de la question.');
    return { question: await createQuestion(content, user.id) };
  },
  { owner: true, mutation: true },
);
export const DELETE = api(
  async (_req, user, ctx) =>
    transaction(async (c) => {
      const id = z
        .string()
        .uuid()
        .parse((await ctx.params).id);
      const r = await c.query(
        "UPDATE question_versions SET status='withdrawn' WHERE id=$1 AND status='active' RETURNING id,concept_key",
        [id],
      );
      if (r.rowCount) {
        await c.query('UPDATE learning_states SET needs_revalidation=true WHERE concept_key=$1', [
          r.rows[0].concept_key,
        ]);
        await audit(c, user.id, 'question.withdraw', id);
      } else if (!(await c.query('SELECT id FROM question_versions WHERE id=$1', [id])).rowCount)
        throw new HttpError(404, 'NOT_FOUND', 'Question introuvable.');
      return { id, status: 'withdrawn' };
    }),
  { owner: true, mutation: true },
);
