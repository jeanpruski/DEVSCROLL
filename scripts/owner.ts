import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';
import { pool, transaction } from '../lib/db';
import { validateConfig } from '../lib/config';

validateConfig();
const input = z
  .object({
    OWNER_EMAIL: z.string().email(),
    OWNER_PASSWORD: z.string().min(12).max(128),
    OWNER_NAME: z.string().default('Jean'),
  })
  .parse(process.env);
try {
  const password = await hashPassword(input.OWNER_PASSWORD);
  await transaction(async (c) => {
    const existing = await c.query('SELECT id FROM "user" WHERE email=$1', [input.OWNER_EMAIL.toLowerCase()]);
    if (existing.rows.length) {
      console.log('Compte déjà présent ; aucune modification de mot de passe.');
      return;
    }
    const id = randomUUID();
    await c.query('INSERT INTO "user"(id,name,email,"emailVerified",role) VALUES($1,$2,$3,true,\'owner\')', [
      id,
      input.OWNER_NAME,
      input.OWNER_EMAIL.toLowerCase(),
    ]);
    await c.query(
      'INSERT INTO account(id,"accountId","providerId","userId",password) VALUES($1,$2,\'credential\',$2,$3)',
      [randomUUID(), id, password],
    );
    await c.query('INSERT INTO user_preferences(user_id) VALUES($1)', [id]);
    console.log('Propriétaire créé.');
  });
} finally {
  await pool.end();
}
