import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pool, transaction } from '../lib/db';
import { postSchema, questionSchema } from '../lib/contracts';
import { createPost, createQuestion, publishPost } from '../modules/content/service';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'yes')
  throw new Error('Seed démo refusé en production.');
try {
  const posts = postSchema.array().parse(JSON.parse(await readFile('content/posts.json', 'utf8')));
  const questions = questionSchema
    .array()
    .parse(JSON.parse(await readFile('content/questions.json', 'utf8')));
  let inserted = 0;
  for (const content of posts) {
    if ((await pool.query('SELECT id FROM posts WHERE slug=$1', [content.slug])).rowCount) continue;
    const result = await createPost(content, null);
    if (content.status === 'published') await publishPost(result.id, null);
    inserted++;
  }
  for (const content of questions) {
    if (
      (await pool.query('SELECT id FROM question_versions WHERE concept_key=$1', [content.conceptKey]))
        .rowCount
    )
      continue;
    await transaction((c) => createQuestion(content, null, c));
  }
  console.log(
    `${inserted} posts ajoutés ; ${posts.length} posts et ${questions.length} questions validés. Seed idempotent.`,
  );
} finally {
  await pool.end();
}
