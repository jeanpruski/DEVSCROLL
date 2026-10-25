import { z } from 'zod';
import { api, readJson } from '@/lib/server';
import { revalidateConcept } from '@/modules/reviews/service';
export const POST = api(
  async (req, user) => {
    const data = z.object({ conceptKey: z.string().min(3).max(150) }).parse(await readJson(req));
    return revalidateConcept(user.id, data.conceptKey);
  },
  { mutation: true },
);
