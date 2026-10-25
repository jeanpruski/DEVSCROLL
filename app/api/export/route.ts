import { api, json } from '@/lib/server';
import { pool } from '@/lib/db';
export const GET = api(async (_req, user) => {
  const tables = [
    'user_preferences',
    'saved_posts',
    'post_feedback',
    'learning_states',
    'question_attempts',
    'exposures',
    'exposure_rollups',
    'content_reports',
  ];
  const data: Record<string, unknown> = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    user: { id: user.id, name: user.name, email: user.email },
  };
  for (const table of tables)
    data[table] = (await pool.query(`SELECT * FROM ${table} WHERE user_id=$1`, [user.id])).rows;
  const response = json(data);
  response.headers.set('Content-Disposition', 'attachment; filename="devscroll-personal-data.json"');
  return response;
});
