import { api } from '@/lib/server';
import { getReviews } from '@/modules/reviews/service';
export const GET = api(async (_req, user) => getReviews(user.id));
