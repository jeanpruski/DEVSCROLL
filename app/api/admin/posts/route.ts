import { api, readJson } from '@/lib/server';
import { listPosts } from '@/modules/content/admin';
import { createPost } from '@/modules/content/service';
export const GET = api(async (req) => listPosts(new URL(req.url).searchParams), { owner: true });
export const POST = api(
  async (req, user) => {
    const result = await createPost(await readJson(req), user.id);
    return {
      post: { ...result.content, id: result.id, versionId: result.versionId, version: result.version },
    };
  },
  { owner: true, mutation: true },
);
