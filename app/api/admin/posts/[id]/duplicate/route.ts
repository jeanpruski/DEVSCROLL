import { z } from 'zod';
import { api } from '@/lib/server';
import { duplicatePost } from '@/modules/content/admin';
export const POST = api(
  async (_req, user, ctx) => {
    const r = await duplicatePost(
      z
        .string()
        .uuid()
        .parse((await ctx.params).id),
      user.id,
    );
    return { post: { ...r.content, id: r.id, versionId: r.versionId, version: r.version } };
  },
  { owner: true, mutation: true },
);
