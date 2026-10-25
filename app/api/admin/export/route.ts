import { api, json } from '@/lib/server';
import { exportContent } from '@/modules/content/admin';
export const GET = api(
  async () => {
    const r = json(await exportContent());
    r.headers.set('Content-Disposition', 'attachment; filename="devscroll-content.json"');
    return r;
  },
  { owner: true },
);
