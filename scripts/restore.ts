import 'dotenv/config';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { postgresTarget, runPostgres } from './backup-config';

try {
  if (!process.argv[2]) throw new Error('Archive .dump requise.');
  const file = path.resolve(process.argv[2]);
  const info = await stat(file);
  if (!info.isFile()) throw new Error('Archive invalide.');
  const source = postgresTarget(process.env.DATABASE_URL);
  const destination = postgresTarget(process.env.RESTORE_DATABASE_URL);
  if (source.identity === destination.identity)
    throw new Error('La restauration doit viser une base distincte.');
  const manifest = JSON.parse(await readFile(`${file}.json`, 'utf8')) as { sha256?: string };
  const digest = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
  if (!manifest.sha256 || manifest.sha256 !== digest) throw new Error('Empreinte de sauvegarde invalide.');
  const client = new Client({ connectionString: process.env.RESTORE_DATABASE_URL });
  await client.connect();
  try {
    const count = await client.query(
      "SELECT count(*) n FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')",
    );
    if (Number(count.rows[0].n) !== 0) throw new Error('La base de destination doit être vide.');
  } finally {
    await client.end();
  }
  await runPostgres(
    'pg_restore',
    ['--no-owner', '--no-privileges', '--exit-on-error', '--dbname', destination.env.PGDATABASE, file],
    destination.env,
  );
  console.log(
    'Archive restaurée dans la base distincte. Vérifier les comptages et les parcours avant toute bascule.',
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Restauration impossible.');
  process.exitCode = 1;
}
