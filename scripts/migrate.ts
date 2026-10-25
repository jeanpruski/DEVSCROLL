import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pool } from '../lib/db';
import { validateConfig } from '../lib/config';

validateConfig();
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(78512239)');
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of (await readdir('migrations')).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = await readFile(`migrations/${name}`, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
    if (existing.rows.length) {
      if (existing.rows[0].checksum !== checksum)
        throw new Error(`Migration déjà appliquée modifiée : ${name}`);
      continue;
    }
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
      await client.query('COMMIT');
      console.log(`Migration appliquée : ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(78512239)');
  client.release();
  await pool.end();
}
