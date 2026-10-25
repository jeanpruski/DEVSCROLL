import { z } from 'zod';
import { api } from '@/lib/server';
import { changeStatus } from '@/modules/content/service';
export const POST = api(
  async (_req, user, ctx) =>
    changeStatus(
      z
        .string()
        .uuid()
        .parse((await ctx.params).id),
      'archive',
      user.id,
    ),
  { owner: true, mutation: true },
);
