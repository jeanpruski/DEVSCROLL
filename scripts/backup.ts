import 'dotenv/config';
import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { postgresTarget, runPostgres } from './backup-config';

process.umask(0o077);
const file = path.resolve(
  process.argv[2] ?? `.local/backups/devscroll-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`,
);
try {
  const target = postgresTarget(process.env.DATABASE_URL);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await (await open(file, 'wx', 0o600)).close();
  const args = ['--format=custom', '--no-owner', '--no-privileges', '--file', file];
  if (process.env.BACKUP_SNAPSHOT) args.push('--snapshot', process.env.BACKUP_SNAPSHOT);
  try {
    await runPostgres('pg_dump', args, target.env);
  } catch (error) {
    await rm(file, { force: true });
    throw error;
  }
  const bytes = await readFile(file);
  await writeFile(
    `${file}.json`,
    JSON.stringify(
      {
        format: 'postgresql-custom',
        createdAt: new Date().toISOString(),
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        encrypted: false,
      },
      null,
      2,
    ),
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    `Sauvegarde créée : ${file} (${bytes.length} octets). Archive locale privée, non chiffrée ; voir docs/AI.md avant copie externe.`,
  );
} catch {
  console.error(
    'Sauvegarde impossible. Vérifier DATABASE_URL, PG_BIN et le chemin de sortie (fichier nouveau requis).',
  );
  process.exitCode = 1;
}
