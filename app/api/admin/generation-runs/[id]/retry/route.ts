import { z } from 'zod';
import { api, HttpError } from '@/lib/server';
import { retryRun, GenerationError } from '@/modules/generation';
export const POST = api(
  async (_req, user, ctx) => {
    try {
      return await retryRun(
        z
          .string()
          .uuid()
          .parse((await ctx.params).id),
        user.id,
      );
    } catch (e) {
      if (e instanceof GenerationError) throw new HttpError(e.status, e.code, e.message);
      throw e;
    }
  },
  { owner: true, mutation: true, rateLimit: 10 },
);
