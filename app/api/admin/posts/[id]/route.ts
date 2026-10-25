import { z } from 'zod';
import { api, readJson, HttpError } from '@/lib/server';
import { adminPost, saveDraft } from '@/modules/content/admin';
export const GET = api(async (req, _user, ctx) => {
  const value=new URL(req.url).searchParams.get('version');
  const version=value===null?undefined:z.coerce.number().int().positive().max(2147483647).parse(value);
  return adminPost((await ctx.params).id,version);
}, { owner: true });
export const PUT = api(
  async (req, user, ctx) => {
    if(new URL(req.url).searchParams.has('version'))throw new HttpError(409,'HISTORICAL_READ_ONLY','Une version historique se consulte en lecture seule.');
    const r = await saveDraft(
      z
        .string()
        .uuid()
        .parse((await ctx.params).id),
      await readJson(req),
      user.id,
    );
    return { post: { ...r.content, id: r.id, versionId: r.versionId, version: r.version } };
  },
  { owner: true, mutation: true },
);
