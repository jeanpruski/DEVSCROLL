import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
const local = path.resolve('.local');
const bin =
  process.env.PG_BIN ||
  (existsSync('/opt/homebrew/opt/postgresql@16/bin') ? '/opt/homebrew/opt/postgresql@16/bin' : '');
const pg = (name, args, ok = [0]) => {
  const r = spawnSync(bin ? path.join(bin, name) : name, args, { stdio: 'pipe', encoding: 'utf8' });
  if (!ok.includes(r.status)) throw new Error(`${name}: ${r.stderr || r.error?.message || r.stdout}`);
  return r;
};
const action = process.argv[2] || 'setup';
mkdirSync(local, { recursive: true });
if (action === 'setup' && !existsSync('.env')) {
  const template = readFileSync('.env.example', 'utf8')
    .replace('BETTER_AUTH_SECRET=', 'BETTER_AUTH_SECRET=' + randomBytes(48).toString('base64url'))
    .replace('OWNER_PASSWORD=', 'OWNER_PASSWORD=' + randomBytes(20).toString('base64url'));
  writeFileSync('.env', template, { mode: 0o600, flag: 'wx' });
  console.log(
    '.env privé créé. Mot de passe propriétaire à consulter dans OWNER_PASSWORD ; aucun secret affiché.',
  );
}
if (action === 'stop') {
  if (existsSync(path.join(local, 'pgdata', 'postmaster.pid')))
    pg('pg_ctl', ['-D', path.join(local, 'pgdata'), 'stop', '-m', 'fast']);
  console.log('Base locale arrêtée.');
} else {
  if (!existsSync(path.join(local, 'pgdata', 'PG_VERSION')))
    pg('initdb', [
      '-D',
      path.join(local, 'pgdata'),
      '-U',
      'devscroll',
      '--auth-local=trust',
      '--auth-host=trust',
      '--encoding=UTF8',
      '--locale=C',
    ]);
  if (pg('pg_isready', ['-h', '127.0.0.1', '-p', '55432'], [0, 1, 2]).status !== 0)
    pg('pg_ctl', [
      '-D',
      path.join(local, 'pgdata'),
      '-l',
      path.join(local, 'postgres.log'),
      '-o',
      '-p 55432 -h 127.0.0.1 -k ' + local,
      'start',
      '-w',
    ]);
  const has = pg('psql', [
    '-h',
    '127.0.0.1',
    '-p',
    '55432',
    '-U',
    'devscroll',
    '-d',
    'postgres',
    '-tAc',
    "SELECT 1 FROM pg_database WHERE datname='devscroll'",
  ]).stdout.trim();
  if (!has) pg('createdb', ['-h', '127.0.0.1', '-p', '55432', '-U', 'devscroll', 'devscroll']);
  console.log('PostgreSQL local prêt sur 127.0.0.1:55432 (données .local/pgdata).');
}
