import { z } from 'zod';
import { api } from '@/lib/server';
import { publishPost } from '@/modules/content/service';
export const POST = api(
  async (_req, user, ctx) =>
    publishPost(
      z
        .string()
        .uuid()
        .parse((await ctx.params).id),
      user.id,
    ),
  { owner: true, mutation: true },
);
