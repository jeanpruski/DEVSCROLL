import { api } from '@/lib/server';
import { getPost } from '@/modules/content/service';
export const GET = api(async (_req, user, context) => getPost((await context.params).slug, user.id));
