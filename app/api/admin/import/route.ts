import { api, readJson } from '@/lib/server';
import { importPosts } from '@/modules/content/admin';
export const GET = api(
  async () => ({
    schemaVersion: 1,
    instructions:
      'Objet {posts:[], questions:[]} ou tableau de posts. Les nouveaux posts sont importés en brouillon. Les slugs existants sont conservés.',
  }),
  { owner: true },
);
export const POST = api(async (req, user) => importPosts(await readJson(req, 2_000_000), user.id), {
  owner: true,
  mutation: true,
});
