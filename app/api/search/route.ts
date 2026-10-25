import { api } from '@/lib/server';
import { searchPosts } from '@/modules/search/service';
export const GET = api(async (req, user) => searchPosts(user.id, new URL(req.url).searchParams), {
  rateLimit: 120,
});
