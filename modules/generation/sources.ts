import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { GenerationError } from './errors';
import { DEFAULT_SOURCE_HOSTS } from './config';

export type SourceExcerpt = {
  url: string;
  title: string;
  publisher: string;
  accessedAt: string;
  excerpt: string;
};
type Address = { address: string; family: number };
type Resolver = (hostname: string) => Promise<Address[]>;
const MAX_SOURCE_BYTES = 512_000;
const MAX_EXCERPT_CHARS = 5500;

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    // Only global-unicast 2000::/3; reject special, documentation and transition allocations.
    if (!/^[23][0-9a-f]{3}:/.test(lower)) return false;
    const parts = lower.split(':');
    const first = parseInt(parts[0], 16);
    const second = parseInt(parts[1] || '0', 16);
    return (
      !(first === 0x2001 && (second <= 0x1ff || second === 0xdb8)) &&
      first !== 0x2002 &&
      !(first === 0x3fff && second <= 0x0fff)
    );
  }
  return false;
}

export function validateSourceUrl(
  input: string,
  allowedHosts: readonly string[] = DEFAULT_SOURCE_HOSTS,
): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new GenerationError(422, 'SOURCE_URL', 'URL de source invalide.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    isIP(url.hostname.replace(/^\[|\]$/g, '')) ||
    !allowedHosts.includes(url.hostname.toLowerCase())
  ) {
    throw new GenerationError(
      422,
      'SOURCE_FORBIDDEN',
      'Source refusée : HTTPS et hôte documentaire autorisé requis.',
    );
  }
  url.hash = '';
  if (url.href.length > 2000) throw new GenerationError(422, 'SOURCE_URL', 'URL de source trop longue.');
  return url;
}

export async function resolveSourceAddress(
  url: URL,
  resolve: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true }),
) {
  const addresses = await resolve(url.hostname);
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))) {
    throw new GenerationError(422, 'SOURCE_PRIVATE_ADDRESS', 'Source refusée : adresse réseau non publique.');
  }
  return addresses[0];
}

function getPinned(
  url: URL,
  address: Address,
  signal: AbortSignal,
): Promise<{ status: number; location?: string; type: string; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        signal,
        method: 'GET',
        servername: url.hostname,
        family: address.family,
        headers: {
          'User-Agent': 'DevScroll/0.1 (private educational source retrieval)',
          Accept: 'text/html,text/plain',
          'Accept-Encoding': 'identity',
        },
        // Pin the validated IP for this exact connection; a second DNS lookup cannot rebind it.
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.destroy();
          resolve({ status, location: res.headers.location, type: '', body: '' });
          return;
        }
        if (status !== 200) {
          res.destroy();
          reject(new GenerationError(422, 'SOURCE_HTTP', `Source indisponible (HTTP ${status}).`));
          return;
        }
        const type = res.headers['content-type'] ?? '';
        if (
          !/^(text\/html|text\/plain)(;|$)/i.test(type) ||
          (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')
        ) {
          res.destroy();
          reject(
            new GenerationError(422, 'SOURCE_TYPE', 'Source refusée : document texte non compressé requis.'),
          );
          return;
        }
        if (Number(res.headers['content-length'] ?? 0) > MAX_SOURCE_BYTES) {
          res.destroy();
          reject(new GenerationError(422, 'SOURCE_TOO_LARGE', 'Source trop volumineuse.'));
          return;
        }
        const parts: Buffer[] = [];
        let size = 0;
        res.on('data', (part: Buffer) => {
          size += part.length;
          if (size > MAX_SOURCE_BYTES) {
            res.destroy(new GenerationError(422, 'SOURCE_TOO_LARGE', 'Source trop volumineuse.'));
            return;
          }
          parts.push(part);
        });
        res.on('end', () => resolve({ status, type, body: Buffer.concat(parts).toString('utf8') }));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

export function excerptFromHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(
      /&(?:nbsp|amp|lt|gt|quot|#39);/g,
      (e) =>
        ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[e] ?? ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_EXCERPT_CHARS);
}

export async function fetchSource(
  input: string,
  allowedHosts: readonly string[] = DEFAULT_SOURCE_HOSTS,
): Promise<SourceExcerpt> {
  const signal = AbortSignal.timeout(12_000);
  let url = validateSourceUrl(input, allowedHosts);
  for (let hop = 0; hop <= 3; hop++) {
    let abortListener: (() => void) | undefined;
    const address = await Promise.race([
      resolveSourceAddress(url),
      new Promise<never>((_resolve, reject) => {
        abortListener = () =>
          reject(new GenerationError(422, 'SOURCE_TIMEOUT', 'Délai de récupération de la source dépassé.'));
        if (signal.aborted) abortListener();
        else signal.addEventListener('abort', abortListener, { once: true });
      }),
    ]).finally(() => {
      if (abortListener) signal.removeEventListener('abort', abortListener);
    });
    if (signal.aborted)
      throw new GenerationError(422, 'SOURCE_TIMEOUT', 'Délai de récupération de la source dépassé.');
    const response = await getPinned(url, address, signal);
    if (response.status >= 300 && response.status < 400) {
      if (hop === 3 || !response.location)
        throw new GenerationError(422, 'SOURCE_REDIRECT', 'Trop de redirections ou redirection invalide.');
      url = validateSourceUrl(new URL(response.location, url).href, allowedHosts);
      continue;
    }
    const excerpt = response.type.startsWith('text/html')
      ? excerptFromHtml(response.body)
      : response.body.trim().slice(0, MAX_EXCERPT_CHARS);
    if (excerpt.length < 100)
      throw new GenerationError(
        422,
        'SOURCE_EMPTY',
        'Source insuffisante : fournir un extrait documentaire plus complet.',
      );
    const title = response.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    return {
      url: url.href,
      title: title ? excerptFromHtml(title).slice(0, 300) : url.pathname.slice(0, 300) || url.hostname,
      publisher: url.hostname,
      accessedAt: new Date().toISOString(),
      excerpt,
    };
  }
  throw new GenerationError(422, 'SOURCE_REDIRECT', 'Redirection de source refusée.');
}
