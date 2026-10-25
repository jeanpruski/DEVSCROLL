import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { QuestionContent } from '../../lib/contracts';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const userId = randomUUID(),
  email = `review-e2e-${randomUUID()}@test.invalid`,
  password = randomUUID();
let question: QuestionContent;
test.beforeAll(async () => {
  if (
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname)
  )
    throw new Error('Ces tests exigent une base locale de développement.');
  question = (JSON.parse(await readFile('content/questions.json', 'utf8')) as QuestionContent[])[0];
  await pool.query('INSERT INTO "user"(id,name,email,role) VALUES($1,$2,$3,$4)', [
    userId,
    'Lecteur test temporaire',
    email,
    'reader',
  ]);
  await pool.query(
    'INSERT INTO account(id,"accountId","providerId","userId",password) VALUES($1,$2,$3,$2,$4)',
    [randomUUID(), userId, 'credential', await hashPassword(password)],
  );
  await pool.query(
    "INSERT INTO learning_states(user_id,concept_key,due_at) VALUES($1,$2,now()-interval '1 day')",
    [userId, question.conceptKey],
  );
});
test.afterAll(async () => {
  await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
  await pool.end();
});
test('révision due, correction puis reprise après rafraîchissement, confiance et échéance', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrer dans mon espace' }).click();
  await expect(page).toHaveURL(/\/feed/);
  await page.goto('/reviews');
  await expect(page.getByRole('heading', { name: question.prompt, exact: true })).toBeVisible();
  const before = await page.request.get('/api/reviews');
  const body = await before.json();
  expect(body.questions[0]).not.toHaveProperty('correctChoiceId');
  expect(body.questions[0]).not.toHaveProperty('explanation');
  await page
    .getByRole('button', {
      name: question.choices.find((c) => c.id === question.correctChoiceId)!.text,
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(page.getByText('Bien vu.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Bien vu.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuer avec confiance' }).click();
  await expect(page.getByRole('heading', { name: 'Tout est à jour pour le moment.' })).toBeVisible();
  const state = (
    await pool.query('SELECT stage_index,due_at FROM learning_states WHERE user_id=$1 AND concept_key=$2', [
      userId,
      question.conceptKey,
    ])
  ).rows[0];
  expect(state.stage_index).toBe(1);
  expect(Math.abs(new Date(state.due_at).getTime() - Date.now() - 3 * 86400000)).toBeLessThan(60000);
  await pool.query(
    "UPDATE learning_states SET due_at=now()-interval '1 day' WHERE user_id=$1 AND concept_key=$2",
    [userId, question.conceptKey],
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Passer', exact: true })).toBeVisible();
  const dueBefore = (await pool.query('SELECT due_at FROM learning_states WHERE user_id=$1', [userId]))
    .rows[0].due_at;
  await page.getByRole('button', { name: 'Passer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tout est à jour pour le moment.' })).toBeVisible();
  const after = (
    await pool.query('SELECT stage_index,due_at FROM learning_states WHERE user_id=$1', [userId])
  ).rows[0];
  expect(after.stage_index).toBe(1);
  expect(after.due_at).toEqual(dueBefore);
  await page.goto('/admin/posts');
  await expect(page).toHaveURL(/\/feed/);
});
