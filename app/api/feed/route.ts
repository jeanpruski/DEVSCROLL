import { api } from '@/lib/server';
import { getFeed } from '@/modules/feed/service';
export const GET = api(async (req, user) => {
  const p = new URL(req.url).searchParams;
  return getFeed(user.id, p.get('cursor'), p.get('replay') === '1', p.get('sessionId'));
});
