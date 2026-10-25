import { z } from 'zod';
import { api, readJson } from '@/lib/server';
import { pool } from '@/lib/db';
const schema = z.object({
  topics: z.array(z.string().min(1).max(60)).max(30),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  reviewsEnabled: z.boolean(),
  sessionMinutes: z.number().int().min(1).max(60),
  onboarded: z.boolean(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
  timezone: z
    .string()
    .max(80)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat('fr', { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, 'Fuseau invalide')
    .optional(),
  softSnap: z.boolean().optional(),
});
export const GET = api(async (_req, user) => {
  await pool.query('INSERT INTO user_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING', [user.id]);
  return {
    preferences: (await pool.query('SELECT data FROM user_preferences WHERE user_id=$1', [user.id])).rows[0]
      .data,
  };
});
export const PUT = api(
  async (req, user) => {
    const data = schema.parse(await readJson(req));
    const result = await pool.query(
      'INSERT INTO user_preferences(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET data=user_preferences.data||EXCLUDED.data,updated_at=now() RETURNING data',
      [user.id, JSON.stringify(data)],
    );
    return { preferences: result.rows[0].data };
  },
  { mutation: true },
);
