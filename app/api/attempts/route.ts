import { api, readJson } from '@/lib/server';
import { submitAttempt } from '@/modules/reviews/service';
export const POST = api(async (req, user) => submitAttempt(user.id, await readJson(req)), {
  mutation: true,
  rateLimit: 120,
});
