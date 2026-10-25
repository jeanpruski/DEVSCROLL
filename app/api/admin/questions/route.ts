import { api, readJson } from '@/lib/server';
import { pool } from '@/lib/db';
import { createQuestion } from '@/modules/content/service';
export const GET = api(
  async () => ({
    questions: (
      await pool.query(
        'SELECT id,concept_key "conceptKey",version,prompt,choices,correct_choice_id "correctChoiceId",explanation,status FROM question_versions ORDER BY created_at DESC LIMIT 500',
      )
    ).rows,
  }),
  { owner: true },
);
export const POST = api(
  async (req, user) => ({ question: await createQuestion(await readJson(req), user.id) }),
  { owner: true, mutation: true },
);
