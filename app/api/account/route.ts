import { api, readJson, HttpError, json } from '@/lib/server';
import { pool } from '@/lib/db';
export const DELETE = api(
  async (req, user) => {
    const data = (await readJson(req)) as { confirmation?: string };
    if (data.confirmation !== user.email)
      throw new HttpError(422, 'CONFIRMATION', 'Confirme la suppression avec ton adresse email.');
    await pool.query('DELETE FROM "user" WHERE id=$1', [user.id]);
    const r = json({ deleted: true });
    r.headers.set('Clear-Site-Data', '"cache", "cookies", "storage"');
    return r;
  },
  { mutation: true },
);
