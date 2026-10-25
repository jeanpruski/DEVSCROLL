import { api, readJson, HttpError } from '@/lib/server';
import { generationConfig, createRun, listRuns, getBudget, GenerationError } from '@/modules/generation';
export const GET = api(
  async () => ({ config: generationConfig(), runs: await listRuns(), budget: await getBudget() }),
  { owner: true },
);
export const POST = api(
  async (req, user) => {
    try {
      return await createRun(user.id, await readJson(req));
    } catch (e) {
      if (e instanceof GenerationError) throw new HttpError(e.status, e.code, e.message);
      throw e;
    }
  },
  { owner: true, mutation: true, rateLimit: 10 },
);
