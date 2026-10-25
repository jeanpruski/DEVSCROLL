import 'dotenv/config';
import { cp, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.NODE_ENV = 'production';
process.env.HOSTNAME = process.env.BIND_HOST || '0.0.0.0';
const standalone = path.resolve('.next/standalone');
try {
  await access(path.join(standalone, 'server.js'));
} catch {
  console.error('Build absent. Exécuter npm run build avant npm start.');
  process.exit(1);
}
await cp('public', path.join(standalone, 'public'), { recursive: true });
await cp('.next/static', path.join(standalone, '.next/static'), { recursive: true });
await import(pathToFileURL(path.join(standalone, 'server.js')).href);
