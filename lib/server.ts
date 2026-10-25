import { z } from 'zod';
import type { AppUser } from './contracts';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
export type RouteContext = { params: Promise<Record<string, string>> };
type Handler = (req: Request, user: AppUser, context: RouteContext) => Promise<Response | unknown>;
const counters = new Map<string, { hits: number; until: number }>();
export function api(
  handler: Handler,
  options: { owner?: boolean; mutation?: boolean; rateLimit?: number } = {},
) {
  return async (req: Request, context: RouteContext = { params: Promise.resolve({}) }) => {
    const requestId = crypto.randomUUID();
    try {
      const { getUser } = await import('./auth');
      const user = await getUser(req.headers);
      if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Connexion requise.');
      if (options.owner && user.role !== 'owner')
        throw new HttpError(403, 'FORBIDDEN', 'Accès réservé au propriétaire.');
      if (options.mutation) assertOrigin(req);
      if (options.rateLimit) {
        const key = `${user.id}:${new URL(req.url).pathname}`;
        const now = Date.now();
        const counter = counters.get(key);
        const current = counter && counter.until > now ? counter : { hits: 0, until: now + 60_000 };
        current.hits++;
        counters.set(key, current);
        if (counters.size > 10_000) for (const [k, v] of counters) if (v.until < now) counters.delete(k);
        if (current.hits > options.rateLimit)
          throw new HttpError(429, 'RATE_LIMIT', 'Réessaie dans une minute.');
      }
      const result = await handler(req, user, context);
      return result instanceof Response ? result : json(result);
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message, code: error.code, requestId }, error.status);
      if (error instanceof z.ZodError)
        return json(
          {
            error: 'Données invalides.',
            code: 'VALIDATION',
            issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
            requestId,
          },
          422,
        );
      if ((error as { code?: string }).code === '23505')
        return json({ error: 'Cet élément existe déjà.', code: 'CONFLICT', requestId }, 409);
      console.error(
        JSON.stringify({
          level: 'error',
          requestId,
          event: 'api_error',
          name: error instanceof Error ? error.name : 'Unknown',
          code: (error as { code?: string }).code,
        }),
      );
      return json({ error: 'Service temporairement indisponible.', code: 'UNAVAILABLE', requestId }, 503);
    }
  };
}
export function assertOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const expected = new URL(process.env.BETTER_AUTH_URL ?? req.url).origin;
  if (!origin || origin !== expected) throw new HttpError(403, 'ORIGIN', 'Origine de la requête refusée.');
}
export async function readJson(req: Request, maxBytes = 1_000_000): Promise<unknown> {
  if (!req.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(415, 'CONTENT_TYPE', 'JSON requis.');
  if (Number(req.headers.get('content-length') ?? 0) > maxBytes)
    throw new HttpError(413, 'TOO_LARGE', 'Requête trop volumineuse.');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, 'INVALID_JSON', 'JSON requis.');
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, 'TOO_LARGE', 'Requête trop volumineuse.');
    }
    parts.push(item.value);
  }
  try {
    const data = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      data.set(part, offset);
      offset += part.length;
    }
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'JSON invalide.');
  }
}
