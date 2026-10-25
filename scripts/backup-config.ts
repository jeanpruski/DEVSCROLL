import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function postgresTarget(value: string | undefined) {
  if (!value) throw new Error('URL PostgreSQL requise.');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1))
    throw new Error('URL PostgreSQL invalide.');
  return {
    identity: `${url.hostname.toLowerCase()}:${url.port || '5432'}/${decodeURIComponent(url.pathname.slice(1))}`,
    env: {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      ...(url.searchParams.has('sslmode') ? { PGSSLMODE: url.searchParams.get('sslmode')! } : {}),
    },
  };
}
export async function runPostgres(name: 'pg_dump' | 'pg_restore', args: string[], env: NodeJS.ProcessEnv) {
  const bin =
    process.env.PG_BIN ||
    (existsSync('/opt/homebrew/opt/postgresql@16/bin') ? '/opt/homebrew/opt/postgresql@16/bin' : '');
  await new Promise<void>((resolve, reject) => {
    // Passwords stay in the subprocess environment, never command arguments or logs.
    const child = spawn(bin ? path.join(bin, name) : name, args, {
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let message = '';
    child.stderr.on('data', (chunk) => {
      if (message.length < 4000) message += String(chunk);
    });
    child.once('error', () =>
      reject(new Error(`${name} indisponible : installer les outils PostgreSQL ou définir PG_BIN.`)),
    );
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${name} a échoué (code ${code}). Vérifier version, connexion et droits. ${message.replace(/postgres(?:ql)?:\/\/\S+/g, '[URL masquée]')}`,
            ),
          ),
    );
  });
}
