import { z } from 'zod';
import { api } from '@/lib/server';
import { pool } from '@/lib/db';
import { savePost } from '@/modules/content/service';
export const PUT = api(
  async (_req, user, context) =>
    savePost(
      user.id,
      z
        .string()
        .uuid()
        .parse((await context.params).id),
    ),
  { mutation: true },
);
export const DELETE = api(
  async (_req, user, context) => {
    await pool.query('DELETE FROM saved_posts WHERE user_id=$1 AND post_id=$2', [
      user.id,
      z
        .string()
        .uuid()
        .parse((await context.params).id),
    ]);
    return { saved: false };
  },
  { mutation: true },
);
