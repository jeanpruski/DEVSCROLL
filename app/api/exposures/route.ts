import { api, readJson } from '@/lib/server';
import { recordExposure } from '@/modules/feed/service';
export const POST = api(async (req, user) => recordExposure(user.id, await readJson(req)), {
  mutation: true,
  rateLimit: 180,
});
