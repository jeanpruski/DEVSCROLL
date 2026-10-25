import { z } from 'zod';
import { api, HttpError } from '@/lib/server';
import { getRun, GenerationError } from '@/modules/generation';
export const GET = api(
  async (_req, _user, ctx) => {
    try {
      return {
        run: await getRun(
          z
            .string()
            .uuid()
            .parse((await ctx.params).id),
        ),
      };
    } catch (e) {
      if (e instanceof GenerationError) throw new HttpError(e.status, e.code, e.message);
      throw e;
    }
  },
  { owner: true },
);
