import { api } from '@/lib/server';
import { quality } from '@/modules/content/admin';
export const GET = api(async () => quality(), { owner: true });
